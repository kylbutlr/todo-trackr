import { afterEach, expect, it, vi } from "vitest";
import { connection, normalizeServerURL, serverSettings } from "../apps/browser-extension/connection.js";

afterEach(() => vi.unstubAllGlobals());

it("normalizes only supported server origins", () => {
  expect(normalizeServerURL(" https://EXAMPLE.test:443/ ")).toBe("https://example.test");
  expect(normalizeServerURL("http://127.0.0.1:8888")).toBe("http://127.0.0.1:8888");
  for (const value of ["http://remote.test", "https://user:secret@example.test", "https://example.test/api", "https://example.test?token=secret"]) {
    expect(() => normalizeServerURL(value)).toThrow();
  }
});

it("starts without a maintainer connection and preserves only an existing legacy credential", async () => {
  const get = vi.fn().mockResolvedValue({});
  const fetcher = vi.fn();
  vi.stubGlobal("chrome", { storage: { local: { get } } });
  vi.stubGlobal("fetch", fetcher);
  expect(await connection()).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
  get.mockResolvedValue({ sessionToken: "existing-session" });
  expect(await connection()).toMatchObject({ origin: "https://todotrackr.netlify.app", authenticationMode: "password", token: "existing-session" });
  get.mockResolvedValue({ connection: { origin: "https://owner.test", authenticationMode: "none" } });
  expect(await connection()).toMatchObject({ origin: "https://owner.test", authenticationMode: "none" });
});

it("discovers explicit passwordless mode without treating outages as open access", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ apiVersion: 1, authenticationMode: "none" }));
  vi.stubGlobal("fetch", fetcher);
  expect(await serverSettings("https://owner.test")).toMatchObject({ authenticationMode: "none" });
  expect(fetcher.mock.calls[0][0]).toBe("https://owner.test/api/installation");
  fetcher.mockResolvedValue(new Response(null, { status: 503 }));
  await expect(serverSettings("https://owner.test")).rejects.toThrow("503");
  fetcher.mockResolvedValue(Response.json({ apiVersion: 1, authenticationMode: "disabled" }));
  await expect(serverSettings("https://owner.test")).rejects.toThrow("compatible");
  fetcher.mockResolvedValue(new Response(null, { status: 404 }));
  expect(await serverSettings("https://owner.test")).toEqual({ authenticationMode: "password" });
});
