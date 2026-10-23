import { captureTitle } from "./capture.js";
import { connection } from "./connection.js";

const iconUrl = chrome.runtime.getURL("icons/icon-128.png");

async function notify(title, message) {
  await chrome.notifications.create({
    type: "basic",
    iconUrl,
    title,
    message,
  });
}

async function pageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/u.test(tab.url)) {
    throw new Error("Open a normal webpage before using Quick Capture.");
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selection = window.getSelection();
      const slackPage = window.location.hostname === "app.slack.com" || window.location.hostname.endsWith(".slack.com");
      const anchor = selection?.anchorNode instanceof Element
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement;
      const message = anchor?.closest('[data-ts], [data-qa="virtual-list-item"], [role="listitem"]');
      const permalink = message?.querySelector('a[href*="/archives/"][href*="/p"], a[data-qa="message_timestamp"]');
      const href = permalink instanceof HTMLAnchorElement ? permalink.href : undefined;

      return {
        selection: selection?.toString() ?? "",
        pageTitle: document.title,
        pageUrl: href || window.location.href,
        source: slackPage ? "slack" : "browser",
        exactSource: Boolean(href),
      };
    },
  });
  const context = results[0]?.result;
  if (!context) throw new Error("Todo Trackr could not read the active page.");
  return context;
}

async function quickCapture() {
  const selected = await connection();
  if (!selected || (selected.authenticationMode !== "none" && !selected.token)) {
    await chrome.action.setBadgeBackgroundColor({ color: "#ff9189" });
    await chrome.action.setBadgeText({ text: "!" });
    throw new Error("Connect to your server through the Todo Trackr extension first.");
  }

  const context = await pageContext();
  const title = captureTitle(context.selection, context.pageTitle, context.pageUrl);
  if ((await connection())?.origin !== selected.origin) throw new Error("The server changed. Open the extension and try again.");
  const response = await fetch(`${selected.origin}/api/tasks`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(selected.token ? { authorization: `Bearer ${selected.token}` } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title,
      source: context.source,
      sourceUrl: context.pageUrl,
    }),
  });

  if (response.status === 401) {
    await chrome.storage.local.remove("sessionToken");
    throw new Error("Your Todo Trackr session expired. Open the extension to sign in again.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Todo Trackr returned HTTP ${response.status}.`);
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#a9cec2" });
  await chrome.action.setBadgeText({ text: "✓" });
  setTimeout(() => void chrome.action.setBadgeText({ text: "" }), 2500);
  const message = context.source === "slack" && !context.exactSource
    ? `${title}\nSaved with the Slack conversation link.`
    : title;
  await notify("Task captured", message);
  return { ok: true, title };
}

async function captureWithFeedback() {
  try {
    return await quickCapture();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quick Capture failed.";
    await notify("Todo Trackr could not capture this", message);
    return { ok: false, error: message };
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "quick-capture") void captureWithFeedback();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "quick-capture") return false;
  void captureWithFeedback().then(sendResponse);
  return true;
});
