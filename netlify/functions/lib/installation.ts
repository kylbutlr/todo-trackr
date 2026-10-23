import { HttpError } from "./http.js";

export type AuthenticationMode = "password" | "none";
export type Integration = "shortcut" | "granola" | "codex";

export function isStandalone(): boolean {
  const runtime = process.env.TODO_TRACKER_RUNTIME?.trim() || "netlify";
  if (runtime !== "netlify" && runtime !== "standalone") throw new Error("Invalid Todo Trackr runtime.");
  return runtime === "standalone";
}

export function authenticationMode(): AuthenticationMode {
  const mode = process.env.TODO_TRACKER_AUTH_MODE?.trim() || "password";
  if (mode !== "password" && mode !== "none") throw new Error("TODO_TRACKER_AUTH_MODE must be password or none.");
  if (mode === "none" && !isStandalone()) throw new Error("Passwordless access requires the standalone runtime.");
  return mode;
}

export function publicOrigin(): URL {
  const origin = new URL(process.env.TODO_TRACKER_PUBLIC_ORIGIN?.trim() || "http://127.0.0.1:8888");
  if (!isLoopback(origin.hostname) && origin.protocol !== "https:") throw new Error("Remote servers require an HTTPS public origin.");
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("TODO_TRACKER_PUBLIC_ORIGIN must be an HTTP(S) origin without a path or credentials.");
  }
  return origin;
}

export function isLoopback(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());
}

export function integrationEnabled(integration: Integration): boolean {
  const value = process.env[`TODO_TRACKER_${integration.toUpperCase()}_ENABLED`]?.trim();
  if (value !== undefined && value !== "true" && value !== "false") throw new Error(`Invalid ${integration} integration switch.`);
  if (isStandalone() && value === "true") throw new Error(`${integration} still requires the legacy hosted adapter; it is not supported by the standalone runtime yet.`);
  // Preserve existing deployments. Independent installations start with no adapters.
  return value === undefined ? !isStandalone() : value === "true";
}

export function workSwitchEnabled(): boolean {
  return !isStandalone() && Boolean(process.env.APP_SWITCHR_URL || process.env.APP_SWITCHR_READER_TOKEN);
}

export function installationCapabilities() {
  return {
    apiVersion: 1,
    authenticationMode: authenticationMode(),
    workSwitch: workSwitchEnabled(),
    integrations: {
      shortcut: integrationEnabled("shortcut"),
      granola: integrationEnabled("granola"),
      codex: integrationEnabled("codex"),
    },
  };
}

export function assertBrowserOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = isStandalone() ? publicOrigin().origin : new URL(request.url).origin;
  // Native clients and the extension do not use ambient web cookies. Extensions
  // may send their own origin, but are still subject to session authentication.
  if (origin && origin !== expected && !/^chrome-extension:\/\/[a-p]{32}$/u.test(origin)) {
    throw new HttpError(403, "Request origin is not allowed.");
  }
  if (request.headers.get("sec-fetch-site") === "cross-site" && !origin?.startsWith("chrome-extension://")) {
    throw new HttpError(403, "Cross-site requests are not allowed.");
  }
}

export function assertIntegrationRoute(pathname: string): void {
  const provider = pathname.match(/^\/api\/(?:connections|ingest|webhooks)\/(shortcut|granola|codex)(?:\/|$)/u)?.[1];
  if (provider && !integrationEnabled(provider as Integration)) throw new HttpError(404, "Integration is disabled.");
  if (pathname.startsWith("/api/shortcut-board") && !integrationEnabled("shortcut")) throw new HttpError(404, "Integration is disabled.");
  if ((pathname.includes("/codex-sessions") || pathname.startsWith("/api/codex-sessions")) && !integrationEnabled("codex")) {
    throw new HttpError(404, "Integration is disabled.");
  }
}
