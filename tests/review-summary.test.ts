import { describe, expect, it, vi } from "vitest";

import { loadReviewSummary } from "../netlify/functions/lib/review-summary.js";

describe("combined review summary", () => {
  it("combines Granola and actionable Shortcut items in Review mode", async () => {
    const summary = await loadReviewSummary({
      granolaPendingCount: async () => 3,
      shortcutConnection: async () => ({ controlMode: "review" }),
      shortcutPreview: async () => ({
        items: [
          { action: "create" },
          { action: "ignore" },
          { action: "update" },
        ] as never,
      }),
      now: () => new Date("2026-08-21T12:00:00.000Z"),
    });

    expect(summary).toEqual({
      generatedAt: "2026-08-21T12:00:00.000Z",
      total: 5,
      sources: { granola: 3, shortcut: 2 },
    });
  });

  it.each(["automatic", "off"] as const)("does not preview Shortcut in %s mode", async (controlMode) => {
    const shortcutPreview = vi.fn();
    const summary = await loadReviewSummary({
      granolaPendingCount: async () => 2,
      shortcutConnection: async () => ({ controlMode }),
      shortcutPreview,
    });

    expect(summary.total).toBe(2);
    expect(summary.sources).toEqual({ granola: 2, shortcut: 0 });
    expect(shortcutPreview).not.toHaveBeenCalled();
  });
});
