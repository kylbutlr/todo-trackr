import { connection, normalizeServerURL, serverSettings } from "./connection.js";

const signedOut = document.querySelector("#signed-out");
const signedIn = document.querySelector("#signed-in");
const password = document.querySelector("#password");
const status = document.querySelector("#status");
const serverURL = document.querySelector("#server-url");
const destination = document.querySelector("#destination");
let selected;

function showState(connected) {
  signedIn.hidden = !connected;
  signedOut.hidden = connected || !selected || selected.authenticationMode === "none";
  destination.textContent = selected ? `${selected.origin}${selected.authenticationMode === "none" ? " · Passwordless" : ""}` : "Choose your Todo Trackr server to start capturing.";
  document.querySelector("#sign-out").textContent = selected?.authenticationMode === "none" ? "Disconnect" : "Sign out";
}

async function restore() {
  const saved = await connection();
  if (!saved) { selected = undefined; showState(false); return; }
  serverURL.value = saved.origin;
  const settings = await serverSettings(saved.origin);
  selected = { origin: saved.origin, authenticationMode: settings.authenticationMode };
  await chrome.storage.local.set({ connection: selected });
  if (settings.authenticationMode === "none") {
    await chrome.storage.local.remove("sessionToken");
    showState(true);
    status.textContent = "Connected without a password. Anyone who can reach this server can access its tasks.";
    return;
  }
  if (!saved.token) { showState(false); return; }
  const response = await fetch(`${saved.origin}/api/auth/session`, {
    headers: { authorization: `Bearer ${saved.token}` }, redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) await chrome.storage.local.remove("sessionToken");
  else if (!response.ok) throw new Error("The server is unavailable. Try connecting again.");
  showState(response.ok);
}

document.querySelector("#connection-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const origin = normalizeServerURL(serverURL.value);
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) throw new Error("Server permission was declined. Choose Connect to try again.");
    const settings = await serverSettings(origin);
    const previous = await connection();
    if (previous?.origin !== origin || settings.authenticationMode === "none") await chrome.storage.local.remove("sessionToken");
    selected = { origin, authenticationMode: settings.authenticationMode };
    await chrome.storage.local.set({ connection: selected });
    password.value = "";
    await restore();
  } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to connect."; }
  finally { button.disabled = false; }
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selected) return;
  const origin = selected.origin;
  const button = event.submitter;
  button.disabled = true;
  status.textContent = "Signing in…";
  try {
    const response = await fetch(`${origin}/api/auth/login`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: password.value, client: "extension" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to sign in.");
    if ((await connection())?.origin !== origin) throw new Error("The selected server changed. Connect again.");
    if (typeof payload.token !== "string" || !payload.token) throw new Error("The server returned an invalid session.");
    await chrome.storage.local.set({ sessionToken: payload.token });
    await chrome.action.setBadgeText({ text: "" });
    password.value = "";
    status.textContent = "Connected.";
    showState(true);
  } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to sign in."; }
  finally { button.disabled = false; }
});

document.querySelector("#capture").addEventListener("click", async () => {
  status.textContent = "Capturing…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "quick-capture" });
    status.textContent = result.ok ? `Captured: ${result.title}` : result.error;
  } catch { status.textContent = "Capture failed. Open a normal webpage and try again."; }
});

document.querySelector("#open-app").addEventListener("click", () => {
  if (selected) void chrome.tabs.create({ url: selected.origin });
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  await chrome.storage.local.remove(["sessionToken", "connection"]);
  selected = undefined;
  password.value = "";
  status.textContent = "Disconnected. This does not change the server’s access settings.";
  showState(false);
});

restore().catch(() => { status.textContent = "The server could not be reached. Check its address and server permission, then choose Connect."; showState(false); });
