import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { formatReviewCount, shortcutPendingReviewCount } from "../apps/web/src/connectionReview.js";
import type { ShortcutPreview } from "../apps/web/src/types.js";

function preview(controlMode: "off" | "review" | "automatic", actions: ShortcutPreview["items"][number]["action"][]) {
  return {
    connection: { controlMode },
    items: actions.map((action) => ({ action })),
  } as Pick<ShortcutPreview, "connection" | "items">;
}

describe("Connection review indicators", () => {
  it("counts only actionable Shortcut preview items in Review mode", () => {
    expect(shortcutPendingReviewCount(preview("review", ["create", "update", "ignore"]))).toBe(2);
    expect(shortcutPendingReviewCount(preview("automatic", ["create", "update"]))).toBe(0);
    expect(shortcutPendingReviewCount(preview("off", ["create"]))).toBe(0);
  });

  it("keeps large sidebar badges compact", () => {
    expect(formatReviewCount(8)).toBe("8");
    expect(formatReviewCount(100)).toBe("99+");
  });

  it("uses an exact Granola pending count and renders connection badges", () => {
    const repository = readFileSync(new URL("../netlify/functions/lib/automation/granola-repository.ts", import.meta.url), "utf8");
    const application = readFileSync(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");

    expect(repository).toContain("SELECT COUNT(*)::int AS count");
    expect(application).toContain("connection-review-count");
    expect(application).toContain("Shortcut items need review");
    expect(application).toContain("Granola items need review");
  });
});
