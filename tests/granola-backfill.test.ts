import { describe, expect, it, vi } from "vitest";

import { backfillRecentGranolaNotes } from "../netlify/functions/lib/automation/granola-backfill.js";
import { listGranolaNotes } from "../netlify/functions/lib/automation/granola-client.js";

describe("Granola recent-note backfill", () => {
  it("uses Granola's official recent notes endpoint with bounded pagination", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      notes: [{ id: "not_123", updated_at: "2026-08-17T16:00:00Z" }],
      hasMore: false,
      cursor: null,
    }), { status: 200 }));

    await listGranolaNotes({ updatedAfter: "2026-08-10T00:00:00Z", pageSize: 200 }, "grn_test", fetcher);

    const [request, init] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(request.origin + request.pathname).toBe("https://public-api.granola.ai/v1/notes");
    expect(request.searchParams.get("updated_after")).toBe("2026-08-10T00:00:00Z");
    expect(request.searchParams.get("page_size")).toBe("30");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer grn_test");
  });

  it("places explicit Kyle actions into review without creating Tasks", async () => {
    const saveReviewCandidates = vi.fn().mockResolvedValue(1);
    const recordRun = vi.fn().mockResolvedValue(undefined);

    const result = await backfillRecentGranolaNotes("grn_test", {
      days: 7,
      now: new Date("2026-08-17T18:00:00Z"),
    }, {
      listNotes: vi.fn().mockResolvedValue({
        notes: [{ id: "not_123", updated_at: "2026-08-17T16:00:00Z" }],
        hasMore: false,
        cursor: null,
      }),
      getNote: vi.fn().mockResolvedValue({
        id: "not_123",
        title: "Internal: Ops",
        updated_at: "2026-08-17T16:00:00Z",
        web_url: "https://notes.granola.ai/d/not_123",
        summary_text: null,
        summary_markdown: `## Action Items
- **Finish Pete's Notion CMS cleanup** (Kyle)
- Watch the workflow recording`,
      }),
      saveReviewCandidates,
      recordRun,
    });

    expect(saveReviewCandidates).toHaveBeenCalledWith("not_123", expect.arrayContaining([
      expect.objectContaining({ title: "Finish Pete's Notion CMS cleanup", responsibility: "explicit" }),
    ]));
    expect(recordRun).toHaveBeenCalledWith("manual", "succeeded", {
      notes: 1,
      review: 1,
      candidates: 1,
    });
    expect(result).toEqual({
      notesScanned: 1,
      explicitActions: 1,
      reviewCandidates: 1,
      created: 0,
      skipped: 0,
    });
  });
});
