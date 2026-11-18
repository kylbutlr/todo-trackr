export const WORKSPACE_POLL_INTERVAL_MS = 30_000;

export function nextTaskPollIntervalMs(unchangedPolls: number): number {
  if (unchangedPolls <= 0) return WORKSPACE_POLL_INTERVAL_MS;
  if (unchangedPolls === 1) return 60_000;
  if (unchangedPolls === 2) return 120_000;
  return 600_000;
}

export function shouldPollWorkspace(visibilityState: DocumentVisibilityState): boolean {
  return visibilityState === "visible";
}
