import { afterEach, describe, expect, it, vi } from "vitest";
import api from "../netlify/functions/api.mjs";
import { authenticationMode, assertBrowserOrigin, assertIntegrationRoute, installationCapabilities, publicOrigin } from "../netlify/functions/lib/installation.js";
import { requireSession, sessionCookie } from "../netlify/functions/lib/auth.js";
import { handleRequest } from "../server/http.js";

afterEach(() => vi.unstubAllEnvs());

function standalone(mode = "none") {
  vi.stubEnv("TODO_TRACKER_RUNTIME", "standalone");
  vi.stubEnv("TODO_TRACKER_AUTH_MODE", mode);
  vi.stubEnv("TODO_TRACKER_PUBLIC_ORIGIN", "http://127.0.0.1:8888");
}

describe("installation access", () => {
  it("preserves protected hosted installations by default", async () => {
    expect(authenticationMode()).toBe("password");
    await expect(requireSession(new Request("https://todo.test/api/tasks"))).rejects.toMatchObject({ status: 401 });
  });
  it.each(["", "disabled", "false", "NONE"])("does not interpret %j as a passwordless opt-in", (mode) => {
    standalone(mode);
    if (mode === "") expect(authenticationMode()).toBe("password");
    else expect(() => authenticationMode()).toThrow();
  });
  it("refuses to disable hosted authentication", () => {
    vi.stubEnv("TODO_TRACKER_AUTH_MODE", "none");
    expect(() => authenticationMode()).toThrow("standalone");
  });
  it("opens an explicitly passwordless standalone session without secrets", async () => {
    standalone();
    vi.stubEnv("TODO_TRACKER_PASSWORD_HASH", "");
    vi.stubEnv("SESSION_SIGNING_SECRET", "");
    const response = await api(new Request("http://127.0.0.1:8888/api/auth/session"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true, authenticationMode: "none" });
  });
  it("returns only installation capabilities before connecting", async () => {
    standalone();
    expect(installationCapabilities()).toEqual({ apiVersion: 1, authenticationMode: "none", workSwitch: false, integrations: { shortcut: false, granola: false, codex: false } });
    const response = await api(new Request("http://127.0.0.1:8888/api/installation"));
    expect(await response.json()).toEqual(installationCapabilities());
  });
  it.each(["/api/connections/shortcut", "/api/ingest/granola/actions", "/api/shortcut-board", "/api/tasks/abc/codex-sessions"])("rejects disabled integration route %s", (path) => {
    standalone();
    expect(() => assertIntegrationRoute(path)).toThrow("disabled");
  });
  it("retains ingestion authentication when interactive passwords are disabled", async () => {
    standalone();
    vi.stubEnv("TODO_TRACKR_INGEST_TOKEN", "private-test-ingestion-token");
    const response = await api(new Request("http://127.0.0.1:8888/api/ingest/task-alarms/00000000-0000-4000-8000-000000000001", { method: "POST" }));
    expect([401, 403]).toContain(response.status);
  });
  it("rejects foreign browser origins and DNS-rebinding hosts", async () => {
    standalone();
    expect(() => assertBrowserOrigin(new Request("http://127.0.0.1:8888/api/tasks", { headers: { origin: "https://untrusted.test" } }))).toThrow("origin");
    const response = await handleRequest(new Request("http://untrusted.test:8888/api/tasks"));
    expect(response.status).toBe(421);
  });
  it("rejects paths and credentials in the configured public origin", () => {
    standalone();
    for (const origin of ["https://example.test/path", "https://user:password@example.test", "http://example.test"]) {
      vi.stubEnv("TODO_TRACKER_PUBLIC_ORIGIN", origin);
      expect(() => publicOrigin()).toThrow();
    }
  });
  it("uses secure cookies except for explicit local HTTP", () => {
    expect(sessionCookie("test")).toContain(" Secure;");
    expect(sessionCookie("test", false)).not.toContain(" Secure;");
    expect(sessionCookie("test", false)).toContain("HttpOnly;");
  });
});
