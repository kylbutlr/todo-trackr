export function nextPollCountdown(
  nowMs: number,
  nextRunAt: string | null,
  intervalSeconds: number,
): string | null {
  if (!nextRunAt || intervalSeconds <= 0) return null;

  const intervalMs = intervalSeconds * 1_000;
  let nextMs = new Date(nextRunAt).getTime();
  if (!Number.isFinite(nextMs)) return null;
  while (nextMs <= nowMs) nextMs += intervalMs;

  const seconds = Math.max(0, Math.ceil((nextMs - nowMs) / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return minutes > 0 ? `${minutes}:${String(remainder).padStart(2, "0")}` : `0:${String(remainder).padStart(2, "0")}`;
}
