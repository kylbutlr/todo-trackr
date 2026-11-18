import type { ShortcutPreview } from "./types.js";

export function shortcutPendingReviewCount(
  preview: Pick<ShortcutPreview, "connection" | "items">,
): number {
  if (preview.connection.controlMode !== "review") return 0;
  return preview.items.filter(({ action }) => action !== "ignore").length;
}

export function formatReviewCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
