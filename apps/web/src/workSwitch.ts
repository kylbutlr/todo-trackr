import { useEffect, useState } from "react";

type Permission = { configured: boolean; state: "active" | "standby" | "unavailable"; revision: number; leaseSeconds: number; catchUpPending?: boolean };
let permission: Permission | undefined;
let expires = 0;
let wallExpires = 0;
export function automaticWorkAllowed(enabled = true): boolean {
  return !enabled || (permission?.state === "active" && performance.now() < expires && Date.now() < wallExpires);
}
export function useWorkSwitch(enabled: boolean): string | undefined {
  const [label, setLabel] = useState<string>();
  useEffect(() => {
    if (!enabled) {
      permission = undefined; expires = 0; wallExpires = 0;
      setLabel(undefined);
      return;
    }
    let stopped = false, inFlight = false;
    let previous: Permission | undefined;
    async function check() {
      if (stopped || inFlight || !navigator.onLine || document.visibilityState !== "visible") return;
      inFlight = true;
      const wasAllowed = automaticWorkAllowed();
      const started = performance.now();
      try {
        const response = await fetch("/api/work-state", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(5_000) });
        if (!response.ok) throw new Error("Unavailable");
        const next = await response.json() as Permission;
        if (!["active", "standby", "unavailable"].includes(next.state) || typeof next.configured !== "boolean"
          || !Number.isSafeInteger(next.revision) || !Number.isFinite(next.leaseSeconds) || next.leaseSeconds < 0 || next.leaseSeconds > 60) throw new Error("Invalid permission");
        if (stopped) return;
        const remaining = Math.max(0, next.leaseSeconds * 1000 - (performance.now() - started));
        permission = next; expires = performance.now() + remaining; wallExpires = Date.now() + remaining;
        setLabel(!next.configured ? undefined : next.state === "active" ? (next.catchUpPending ? "App Switchr: work on, catch-up pending" : "App Switchr: work on") : next.state === "standby" ? "App Switchr: automatic work paused" : "App Switchr unavailable: automatic work paused");
        if (automaticWorkAllowed() && next.configured && next.catchUpPending) {
            // Background catch-up checks the shared permission again before touching Neon.
            const resumed = await fetch("/api/work-resume", { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(5_000) });
            if (!resumed.ok) throw new Error("Catch-up unavailable");
        }
        if (automaticWorkAllowed() && (!wasAllowed || !previous || previous.state !== "active" || previous.revision !== next.revision || (previous.catchUpPending && !next.catchUpPending))) {
          if (!stopped && automaticWorkAllowed()) window.dispatchEvent(new Event("app-switchr-resumed"));
        }
        previous = next;
      } catch {
        if (stopped) return;
        permission = undefined; expires = 0; wallExpires = 0;
        setLabel("App Switchr unavailable: automatic work paused");
      } finally { inFlight = false; }
    }
    void check();
    const timer = window.setInterval(() => void check(), 30_000);
    const visible = () => void check();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => { stopped = true; permission = undefined; expires = 0; wallExpires = 0; window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, [enabled]);
  return label;
}
