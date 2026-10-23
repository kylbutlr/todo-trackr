import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  extractGranolaActionCandidates,
  extractGranolaActions,
} from "../netlify/functions/lib/automation/granola-actions.js";
import type { GranolaNote } from "../netlify/functions/lib/automation/granola-client.js";
import {
  processGranolaWebhook,
  verifyGranolaWebhookSignature,
} from "../netlify/functions/lib/automation/granola-webhook.js";

const secretBytes = Buffer.from("todo-trackr-granola-webhook-secret");
const secret = `whsec_${secretBytes.toString("base64")}`;
const timestamp = Math.floor(Date.now() / 1_000).toString();
const now = Number(timestamp) * 1_000;

function signature(id: string, body: string): string {
  const digest = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`, "utf8")
    .digest("base64");
  return `v1,${digest}`;
}

function note(markdown: string): GranolaNote {
  return {
    id: "not_123",
    title: "Weekly product sync",
    updated_at: "2026-08-16T18:00:00Z",
    web_url: "https://app.granola.ai/notes/not_123",
    summary_text: null,
    summary_markdown: markdown,
  };
}

describe("Granola webhook ingestion", () => {
  it("verifies a fresh Standard Webhooks signature", () => {
    const body = '{"event_id":"evt_123"}';
    expect(verifyGranolaWebhookSignature(body, "evt_123", timestamp, signature("evt_123", body), secret, now)).toBe(true);
    expect(verifyGranolaWebhookSignature(body, "evt_123", timestamp, "v1,invalid", secret, now)).toBe(false);
    expect(verifyGranolaWebhookSignature(body, "evt_123", timestamp, signature("evt_123", body), secret, now + 6 * 60 * 1_000)).toBe(false);
  });

  it("extracts only explicit Kyle or Me actions from action sections", () => {
    expect(extractGranolaActions(note(`
## Overview
Kyle explained the rollout.

## Action Items
- [ ] Kyle: Send the rollout summary.
- Me to confirm the production date
- Ariel: Update the design

## Notes
- Kyle: This is not in the action section
    `))).toEqual([
      expect.objectContaining({ title: "Send the rollout summary", externalReference: expect.stringContaining("not_123:") }),
      expect.objectContaining({ title: "confirm the production date", externalReference: expect.stringContaining("not_123:") }),
    ]);
  });

  it("extracts Granola's title-first Kyle owner format", () => {
    expect(extractGranolaActions(note(`
## Action Items
- **Finish Pete's Notion CMS cleanup, then review with Michael and Matt** (Kyle)
- **Ship the updated integration notes** (Kyle / Matt)
- **Prepare the client recap** (Ariel)
    `))).toEqual([
      expect.objectContaining({
        title: "Finish Pete's Notion CMS cleanup, then review with Michael and Matt",
        sourceExcerpt: "**Finish Pete's Notion CMS cleanup, then review with Michael and Matt** (Kyle)",
      }),
      expect.objectContaining({ title: "Ship the updated integration notes" }),
    ]);
  });

  it("keeps a stable action reference when Granola edits the title in place", () => {
    const original = extractGranolaActions(note("## Next Steps\n- First draft (Kyle)"));
    const edited = extractGranolaActions(note("## Next Steps\n- Final draft (Kyle)"));

    expect(original[0]?.externalReference).toBe(edited[0]?.externalReference);
  });

  it("rejects unassigned next steps instead of filling the review queue with team actions", () => {
    const candidates = extractGranolaActionCandidates(note(`
## Next Steps
- Watch the two workflow recordings when Ariel sends them
- Ariel: Send the recordings
    `));

    expect(candidates).toEqual([]);
    expect(extractGranolaActions(note(`
## Next Steps
- Watch the two workflow recordings when Ariel sends them
    `))).toEqual([]);
  });

  it("fetches a changed note and holds its explicit Kyle action for review", async () => {
    const event = {
      event_id: "evt_123",
      event_type: "note.edited",
      note_id: "not_123",
      occurred_at: "2026-08-16T18:00:00Z",
    };
    const body = JSON.stringify(event);
    const claim = vi.fn().mockResolvedValue(true);
    const finish = vi.fn().mockResolvedValue(undefined);
    const getNote = vi.fn().mockResolvedValue(note("## Next Steps\n- Kyle will Send the recap"));
    const saveReviewCandidates = vi.fn().mockResolvedValue(1);

    await processGranolaWebhook(
      body,
      { id: event.event_id, timestamp, signature: signature(event.event_id, body) },
      { webhook: secret, apiKey: "grn_test" },
      { claim, finish, getNote, saveReviewCandidates },
    );

    expect(claim).toHaveBeenCalledWith("evt_123", "not_123");
    expect(getNote).toHaveBeenCalledWith("not_123", "grn_test");
    expect(saveReviewCandidates).toHaveBeenCalledWith("not_123", [
      expect.objectContaining({ title: "Send the recap", responsibility: "explicit" }),
    ]);
    expect(finish).toHaveBeenCalledWith("evt_123", "succeeded", "1 personal next step needs review.");
  });

  it("records an event as ignored when no explicit Kyle action exists", async () => {
    const event = {
      event_id: "evt_empty",
      event_type: "note.generated",
      note_id: "not_123",
      occurred_at: "2026-08-16T18:00:00Z",
    };
    const body = JSON.stringify(event);
    const finish = vi.fn().mockResolvedValue(undefined);

    await processGranolaWebhook(
      body,
      { id: event.event_id, timestamp, signature: signature(event.event_id, body) },
      { webhook: secret, apiKey: "grn_test" },
      {
        claim: vi.fn().mockResolvedValue(true),
        finish,
        getNote: vi.fn().mockResolvedValue(note("## Notes\n- Kyle discussed the launch")),
        saveReviewCandidates: vi.fn().mockResolvedValue(0),
      },
    );

    expect(finish).toHaveBeenCalledWith("evt_empty", "ignored", "No explicit Kyle action was found.");
  });

  it("ignores unassigned action-section bullets", async () => {
    const event = {
      event_id: "evt_review",
      event_type: "note.generated",
      note_id: "not_123",
      occurred_at: "2026-08-16T18:00:00Z",
    };
    const body = JSON.stringify(event);
    const finish = vi.fn().mockResolvedValue(undefined);
    const saveReviewCandidates = vi.fn().mockResolvedValue(0);

    await processGranolaWebhook(
      body,
      { id: event.event_id, timestamp, signature: signature(event.event_id, body) },
      { webhook: secret, apiKey: "grn_test" },
      {
        claim: vi.fn().mockResolvedValue(true),
        finish,
        getNote: vi.fn().mockResolvedValue(note("## Next Steps\n- Watch the workflow recording")),
        saveReviewCandidates,
      },
    );

    expect(saveReviewCandidates).toHaveBeenCalledWith("not_123", []);
    expect(finish).toHaveBeenCalledWith("evt_review", "ignored", "No explicit Kyle action was found.");
  });
});
