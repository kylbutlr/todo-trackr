import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function fixture(initial = {}) {
  vi.resetModules();
  const stored = structuredClone(initial);
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { value: "", hidden: false, textContent: "", handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; } });
    return elements.get(selector);
  };
  const storage = {
    get: vi.fn(async () => structuredClone(stored)),
    set: vi.fn(async (values) => { Object.assign(stored, structuredClone(values)); }),
    remove: vi.fn(async (keys) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key]; }),
  };
  let granted = false;
  const chrome = {
    storage: { local: storage },
    permissions: {
      contains: vi.fn(async () => granted),
      request: vi.fn(() => new Promise(() => {})),
    },
  };
  const fetcher = vi.fn(async () => Response.json({ apiVersion: 1, authenticationMode: "none" }));
  vi.stubGlobal("chrome", chrome);
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("document", { querySelector: element });
  const settle = () => new Promise((done) => setTimeout(done, 0));
  async function open() { vi.resetModules(); await import("../apps/browser-extension/popup.js"); await settle(); }
  await open();
  return { stored, chrome, fetcher, element, settle, open, allow: () => { granted = true; } };
}

it("resumes server setup after Chrome closes the popup for optional permission approval", async () => {
  const f = await fixture();
  f.element("#server-url").value = "http://127.0.0.1:8888";
  void f.element("#connection-form").handlers.submit({ preventDefault() {}, submitter: {} });
  await f.settle();
  // The first popup is gone, so its permission promise never resumes.
  expect(f.stored.pendingServerOrigin).toBe("http://127.0.0.1:8888");
  f.allow();
  await f.open();
  expect(f.stored.connection).toEqual({ origin: "http://127.0.0.1:8888", authenticationMode: "none" });
  expect(f.stored.pendingServerOrigin).toBeUndefined();
  expect(f.element("#signed-in").hidden).toBe(false);
  expect(f.fetcher).toHaveBeenCalledWith("http://127.0.0.1:8888/api/installation", expect.anything());
});

it("does not contact a pending destination when its permission was denied", async () => {
  const f = await fixture({ pendingServerOrigin: "https://fictional.test" });
  expect(f.fetcher).not.toHaveBeenCalled();
  expect(f.stored.pendingServerOrigin).toBeUndefined();
  expect(f.stored.connection).toBeUndefined();
});

it("clears an old server credential when completing a different approved destination", async () => {
  const f = await fixture({ connection: { origin: "https://previous.test", authenticationMode: "password" }, sessionToken: "previous-token" });
  f.stored.pendingServerOrigin = "http://127.0.0.1:8888";
  f.allow();
  await f.open();
  expect(f.stored.sessionToken).toBeUndefined();
  expect(f.stored.connection.origin).toBe("http://127.0.0.1:8888");
  await f.element("#sign-out").handlers.click();
  expect(f.stored).toEqual({});
});
