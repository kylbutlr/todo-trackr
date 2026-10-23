import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function captureFixture(selected) {
  vi.resetModules(); vi.useFakeTimers();
  const chrome = {
    runtime: { getURL: (path) => `chrome-extension://fixture/${path}`, onMessage: { addListener: vi.fn() } },
    commands: { onCommand: { addListener: vi.fn() } },
    storage: { local: { get: vi.fn().mockResolvedValue(selected), remove: vi.fn().mockResolvedValue() } },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 1, url: "https://example.test/article" }]) },
    scripting: { executeScript: vi.fn().mockResolvedValue([{ result: { selection: "Follow up on this", pageTitle: "Article", pageUrl: "https://example.test/article", source: "browser" } }]) },
    action: { setBadgeText: vi.fn().mockResolvedValue(), setBadgeBackgroundColor: vi.fn().mockResolvedValue() },
    notifications: { create: vi.fn().mockResolvedValue() },
  };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ task: { id: "fixture" } }, { status: 201 }));
  vi.stubGlobal("chrome", chrome); vi.stubGlobal("fetch", fetcher);
  await import("../apps/browser-extension/background.js");
  const listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
  return { chrome, fetcher, capture: () => new Promise((done) => listener({ type: "quick-capture" }, {}, done)) };
}

it("captures to the selected passwordless server without a fabricated credential", async () => {
  const fixture = await captureFixture({ connection: { origin: "http://127.0.0.1:8888", authenticationMode: "none" } });
  expect(await fixture.capture()).toMatchObject({ ok: true, title: "Follow up on this" });
  const [url, request] = fixture.fetcher.mock.calls[0];
  expect(url).toBe("http://127.0.0.1:8888/api/tasks");
  expect(request.headers.authorization).toBeUndefined();
  expect(JSON.parse(request.body)).toEqual({ title: "Follow up on this", source: "browser", sourceUrl: "https://example.test/article" });
  expect(fixture.chrome.notifications.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Task captured" }));
});

it("sends a protected server's credential only to that server and clears it on expiry", async () => {
  const fixture = await captureFixture({ connection: { origin: "https://owner.test", authenticationMode: "password" }, sessionToken: "owner-session" });
  fixture.fetcher.mockResolvedValue(new Response(null, { status: 401 }));
  expect(await fixture.capture()).toMatchObject({ ok: false, error: expect.stringContaining("expired") });
  expect(fixture.fetcher.mock.calls[0][0]).toBe("https://owner.test/api/tasks");
  expect(fixture.fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer owner-session");
  expect(fixture.chrome.storage.local.remove).toHaveBeenCalledWith("sessionToken");
});

it("does not send a pending capture after the selected server changes", async () => {
  const fixture = await captureFixture({ connection: { origin: "https://first.test", authenticationMode: "password" }, sessionToken: "first-session" });
  fixture.chrome.storage.local.get.mockResolvedValueOnce({ connection: { origin: "https://first.test", authenticationMode: "password" }, sessionToken: "first-session" })
    .mockResolvedValue({ connection: { origin: "https://second.test", authenticationMode: "none" } });
  expect(await fixture.capture()).toMatchObject({ ok: false, error: expect.stringContaining("server changed") });
  expect(fixture.fetcher).not.toHaveBeenCalled();
});

it("requires setup before reading the active page or sending task content", async () => {
  const fixture = await captureFixture({});
  expect(await fixture.capture()).toMatchObject({ ok: false, error: expect.stringContaining("Connect") });
  expect(fixture.chrome.scripting.executeScript).not.toHaveBeenCalled();
  expect(fixture.fetcher).not.toHaveBeenCalled();
});
