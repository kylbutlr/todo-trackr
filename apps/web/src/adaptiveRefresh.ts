import { nextTaskPollIntervalMs, WORKSPACE_POLL_INTERVAL_MS } from './workspaceRefreshPolicy.js';

// Ignore response-generation clocks, while keeping source timestamps and real changes significant.
export function refreshFingerprint(snapshot: unknown): string {
  return JSON.stringify(snapshot, (key, value) => key === 'generatedAt' || key === 'nextScanAt' ? undefined : value);
}

export function createAdaptiveRefresh(load: () => Promise<unknown>, allowed: () => boolean) {
  let stopped = false;
  let inFlight = false;
  let previous: string | undefined;
  let unchanged = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule(delay: number) {
    if (timer) clearTimeout(timer);
    if (!stopped) timer = setTimeout(() => void refresh(), delay);
  }

  async function refresh(force = false) {
    if (stopped || inFlight) return;
    if (!force && !allowed()) { schedule(WORKSPACE_POLL_INTERVAL_MS); return; }
    if (force) unchanged = 0;
    inFlight = true;
    try {
      const fingerprint = refreshFingerprint(await load());
      if (stopped) return;
      unchanged = previous === fingerprint ? unchanged + 1 : 0;
      previous = fingerprint;
      schedule(nextTaskPollIntervalMs(unchanged));
    } catch {
      // A failed read must not leave the loop stopped or retry faster than its normal floor.
      schedule(Math.max(60_000, nextTaskPollIntervalMs(unchanged)));
    } finally { inFlight = false; }
  }

  return { refresh, stop() { stopped = true; if (timer) clearTimeout(timer); } };
}
