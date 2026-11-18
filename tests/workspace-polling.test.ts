import { afterEach, expect, it, vi } from "vitest";
import { startWorkspacePolling } from "../apps/web/src/workspacePolling.js";
import { nextTaskPollIntervalMs } from "../apps/web/src/workspaceRefreshPolicy.js";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function environment() {
  vi.useFakeTimers();
  const browser = Object.assign(new EventTarget(), { setInterval, clearInterval });
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const navigator = { onLine: true };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", document);
  vi.stubGlobal("navigator", navigator);
  return { browser, document, navigator };
}

it("makes no automatic task requests during an offline hour and refreshes immediately on reconnect", async () => {
  const { browser, navigator } = environment();
  navigator.onLine = false;
  const request = vi.fn();
  // Even an overdue poll stays local while offline.
  const stop = startWorkspacePolling(request, () => true, () => true);
  try {
    await vi.advanceTimersByTimeAsync(3_600_000);
    browser.dispatchEvent(new Event("focus"));
    expect(request).not.toHaveBeenCalled();
    navigator.onLine = true;
    browser.dispatchEvent(new Event("online"));
    expect(request).toHaveBeenCalledExactlyOnceWith(true);
  } finally { stop(); }
});

it("preserves the quiet backoff and bypasses the deadline on a visible return", async () => {
  const { browser, document } = environment();
  let unchanged = 0;
  let deadline = Date.now() + nextTaskPollIntervalMs(unchanged);
  const request = vi.fn((resumed: boolean) => {
    unchanged = resumed ? 0 : unchanged + 1;
    deadline = Date.now() + nextTaskPollIntervalMs(unchanged);
  });
  const stop = startWorkspacePolling(request, () => Date.now() >= deadline, () => true);
  try {
    await vi.advanceTimersByTimeAsync(210_000);
    expect(request).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(570_000);
    expect(request).toHaveBeenCalledTimes(3);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenLastCalledWith(true);
    expect(request).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(request).toHaveBeenCalledTimes(5);
    browser.dispatchEvent(new Event("focus"));
    expect(request).toHaveBeenLastCalledWith(true);
  } finally { stop(); }
});

it("keeps hidden and standby clients quiet, including reconnect events", async () => {
  const { browser, document } = environment();
  let active = false;
  const request = vi.fn();
  const stop = startWorkspacePolling(request, () => true, () => active);
  try {
    await vi.advanceTimersByTimeAsync(60_000);
    browser.dispatchEvent(new Event("online"));
    expect(request).not.toHaveBeenCalled();
    active = true;
    document.visibilityState = "hidden";
    browser.dispatchEvent(new Event("app-switchr-resumed"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(request).not.toHaveBeenCalled();
    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledExactlyOnceWith(true);
  } finally { stop(); }
});

it("cleans up every listener and timer on unmount or sign-out", async () => {
  const { browser, document } = environment();
  const request = vi.fn();
  const stop = startWorkspacePolling(request, () => true, () => true);
  stop();
  await vi.advanceTimersByTimeAsync(600_000);
  for (const event of ["online", "focus", "app-switchr-resumed"]) browser.dispatchEvent(new Event(event));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(request).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
