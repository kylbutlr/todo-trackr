export function normalizeServerURL(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a complete server URL, including http:// or https://."); }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use an HTTPS server origin, or HTTP on localhost, without a path or credentials.");
  }
  return url.origin;
}

export async function connection() {
  const values = await chrome.storage.local.get(["connection", "sessionToken"]);
  if (values.connection) return { ...values.connection, token: values.sessionToken };
  if (values.sessionToken) return { origin: "https://todotrackr.netlify.app", authenticationMode: "password", token: values.sessionToken };
  return undefined;
}

export async function serverSettings(origin) {
  const response = await fetch(`${origin}/api/installation`, { redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return { authenticationMode: "password" };
  if (!response.ok) throw new Error(`Server settings returned HTTP ${response.status}.`);
  const settings = await response.json();
  if (settings.apiVersion !== 1 || !["password", "none"].includes(settings.authenticationMode)) throw new Error("This server is not compatible with this extension.");
  return settings;
}
