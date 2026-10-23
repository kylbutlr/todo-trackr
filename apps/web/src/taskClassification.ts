import type { Task } from "./types.js";

const releaseTitlePattern = /\brelease\b/iu;
const linkedTicketPattern = /(?:app\.shortcut\.com\/[^\s]+\/story\/\d+|\bsc-\d+\b|\b(?:approved\s+)?tickets?\s*:)/iu;
const conciseReleaseSummaryLimit = 360;

export function isBackgroundReleaseTask(
  task: Pick<Task, "source" | "sourceDetails" | "title">,
): boolean {
  if (task.source !== "shortcut" || !releaseTitlePattern.test(task.title)) return false;

  const summary = task.sourceDetails?.summary?.trim() ?? "";
  return summary.length === 0
    || summary.length <= conciseReleaseSummaryLimit
    || linkedTicketPattern.test(summary);
}
