import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { captureTitle } from "../apps/browser-extension/capture.js";

describe("browser Quick Capture", () => {
  it("uses the product name for the installed extension", () => {
    const manifest = JSON.parse(readFileSync(
      new URL("../apps/browser-extension/manifest.json", import.meta.url),
      "utf8",
    )) as { name: string; action: { default_title: string } };

    expect(manifest.name).toBe("Todo Trackr");
    expect(manifest.action.default_title).toBe("Todo Trackr");
  });

  it("uses compacted selected text as the Task title", () => {
    expect(captureTitle("  Follow up\nwith the client  ", "Ignored page", "https://example.com")).toBe("Follow up with the client");
  });

  it("falls back to the page title when there is no selection", () => {
    expect(captureTitle("", "Project requirements", "https://example.com")).toBe("Project requirements");
  });

  it("keeps generated titles within the Task contract", () => {
    expect(captureTitle("A".repeat(700), "", "https://example.com")).toHaveLength(500);
  });

  it("suggests Command-Shift-E for Quick Capture", () => {
    const manifest = JSON.parse(readFileSync(
      new URL("../apps/browser-extension/manifest.json", import.meta.url),
      "utf8",
    )) as { commands: { "quick-capture": { suggested_key: Record<string, string> } } };

    expect(manifest.commands["quick-capture"].suggested_key).toMatchObject({
      default: "Ctrl+Shift+E",
      mac: "Command+Shift+E",
    });
  });

  it("shows Command-Shift-E in the extension popup", () => {
    const popup = readFileSync(
      new URL("../apps/browser-extension/popup.html", import.meta.url),
      "utf8",
    );

    expect(popup).toContain('class="shortcut-keys"');
    expect(popup).toContain("<kbd>E</kbd>");
    expect(popup).not.toContain("<kbd>Y</kbd>");
  });

  it("keeps browser source attribution visible in the Task dashboard", () => {
    const app = readFileSync(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");

    expect(app).toContain('task.source === "browser" ? "Browser"');
  });

  it("attributes captures from Slack web and looks for a message permalink", () => {
    const background = readFileSync(
      new URL("../apps/browser-extension/background.js", import.meta.url),
      "utf8",
    );

    expect(background).toContain('window.location.hostname === "app.slack.com"');
    expect(background).toContain('a[href*="/archives/"][href*="/p"]');
    expect(background).toContain('source: slackPage ? "slack" : "browser"');
    expect(background).toContain("source: context.source");
  });
});
