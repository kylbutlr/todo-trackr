import { afterEach, expect, it, vi } from 'vitest';
import { createAdaptiveRefresh } from '../apps/web/src/adaptiveRefresh.js';

afterEach(() => vi.useRealTimers());

it('backs off real reads to ten minutes despite response clocks, and resets on data changes', async () => {
  vi.useFakeTimers();
  let title = 'Task';
  const load = vi.fn(async () => ({ title, generatedAt: Date.now(), nextScanAt: Date.now() + 60_000 }));
  const refresh = createAdaptiveRefresh(load, () => true);
  try {
    await refresh.refresh();
    await vi.advanceTimersByTimeAsync(30_000 + 60_000 + 120_000);
    expect(load).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(599_999);
    expect(load).toHaveBeenCalledTimes(4);
    title = 'Changed';
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(load).toHaveBeenCalledTimes(6);
  } finally { refresh.stop(); }
});

it('pauses hidden, offline, or standby reads and stops cleanly', async () => {
  vi.useFakeTimers();
  let allowed = false;
  const load = vi.fn(async () => ({ tasks: [] }));
  const refresh = createAdaptiveRefresh(load, () => allowed);
  await refresh.refresh();
  await vi.advanceTimersByTimeAsync(600_000);
  expect(load).not.toHaveBeenCalled();
  allowed = true;
  await refresh.refresh(true);
  expect(load).toHaveBeenCalledOnce();
  refresh.stop();
  await vi.advanceTimersByTimeAsync(600_000);
  expect(load).toHaveBeenCalledOnce();
});

it('shares overlapping requests and recovers after a failure', async () => {
  vi.useFakeTimers();
  let resolve!: (value: unknown) => void;
  const load = vi.fn<() => Promise<unknown>>().mockRejectedValueOnce(Error('offline'))
    .mockImplementation(() => new Promise(done => { resolve = done; }));
  const refresh = createAdaptiveRefresh(load, () => true);
  try {
    await refresh.refresh();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).toHaveBeenCalledTimes(2);
    await refresh.refresh(true);
    expect(load).toHaveBeenCalledTimes(2);
    resolve({ tasks: [] });
    await Promise.resolve();
  } finally { refresh.stop(); }
});
