import { afterEach, expect, it, vi } from "vitest";
import { startWorkspacePolling } from "../apps/web/src/workspacePolling.js";

const hooks = vi.hoisted(() => ({ effect: undefined as undefined | (() => (() => void) | void) }));
// Register the real hook's effect without mounting UI. Requests, leases, events,
// single-flight handling and cleanup all run through the production control loop.
vi.mock("react", () => ({
  useEffect: (effect: typeof hooks.effect) => { hooks.effect = effect; },
  useState: () => [undefined, vi.fn()],
}));

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

async function environment(online = true) {
  vi.useFakeTimers();
  const browser = Object.assign(new EventTarget(), { setInterval, clearInterval });
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const navigator = { onLine: online };
  const resumed = vi.fn();
  browser.addEventListener("app-switchr-resumed", resumed);
  const fetcher = vi.fn(async () => Response.json({ configured: true, state: "active", revision: 1, leaseSeconds: 60 }));
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", document);
  vi.stubGlobal("navigator", navigator);
  vi.stubGlobal("fetch", fetcher);
  const client = await import("../apps/web/src/workSwitch.js");
  client.useWorkSwitch(true);
  const stop = hooks.effect!() as () => void;
  return { browser, document, navigator, resumed, fetcher, client, stop };
}

it("suppresses an offline hour of control requests and checks immediately on reconnect", async () => {
  const { browser, navigator, resumed, fetcher, stop } = await environment(false);
  try {
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(fetcher).not.toHaveBeenCalled();
    navigator.onLine = true;
    browser.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(resumed).toHaveBeenCalledOnce();
  } finally { stop(); }
});

it("refreshes task surfaces after renewing an expired lease even when the revision is unchanged", async () => {
  const { browser, navigator, resumed, fetcher, client, stop } = await environment();
  let stopTasks = () => {};
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(resumed).toHaveBeenCalledOnce();
    navigator.onLine = false;
    await vi.advanceTimersByTimeAsync(65_000);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(client.automaticWorkAllowed()).toBe(false);
    const taskRequest = vi.fn();
    stopTasks = startWorkspacePolling(taskRequest, () => true, () => client.automaticWorkAllowed());
    navigator.onLine = true;
    browser.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(client.automaticWorkAllowed()).toBe(true);
    expect(resumed).toHaveBeenCalledTimes(2);
    expect(taskRequest).toHaveBeenCalledExactlyOnceWith(true);
  } finally { stopTasks(); stop(); }
});

it("does not emit extra task refreshes for healthy unchanged permission checks", async () => {
  const { fetcher, resumed, stop } = await environment();
  try {
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(resumed).toHaveBeenCalledOnce();
  } finally { stop(); }
});

it("keeps hidden control checks quiet and removes timers/listeners on sign-out", async () => {
  const { browser, document, navigator, fetcher, stop } = await environment(false);
  document.visibilityState = "hidden";
  navigator.onLine = true;
  try {
    await vi.advanceTimersByTimeAsync(60_000);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetcher).not.toHaveBeenCalled();
  } finally { stop(); }
  browser.dispatchEvent(new Event("online"));
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetcher).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
