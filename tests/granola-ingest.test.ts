import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { granolaIngestSchema } from "../netlify/functions/lib/automation/granola-ingest.js";
import { requireAutomationIngestAuthorization } from "../netlify/functions/lib/automation/ingest-auth.js";

const previousToken = process.env.TODO_TRACKR_INGEST_TOKEN;

beforeEach(() => {
  process.env.TODO_TRACKR_INGEST_TOKEN = "granola-ingest-test-token";
});

afterEach(() => {
  if (previousToken === undefined) delete process.env.TODO_TRACKR_INGEST_TOKEN;
  else process.env.TODO_TRACKR_INGEST_TOKEN = previousToken;
});

describe("Granola action ingestion", () => {
  it("normalizes one idempotent next step", () => {
    expect(granolaIngestSchema.parse({
      actions: [{
        externalReference: "meeting-123/action-1",
        title: "  Send the staging link  ",
        sourceUrl: "https://app.granola.ai/notes/meeting-123",
      }],
    })).toEqual({
      actions: [{
        externalReference: "meeting-123/action-1",
        title: "Send the staging link",
        notes: "",
        sourceUrl: "https://app.granola.ai/notes/meeting-123",
        sourceExcerpt: null,
        dueAt: null,
        sourceUpdatedAt: null,
      }],
    });
  });

  it("requires the exact server-to-server bearer token", () => {
    expect(() => requireAutomationIngestAuthorization(new Request("https://example.com", {
      headers: { authorization: "Bearer granola-ingest-test-token" },
    }))).not.toThrow();
    expect(() => requireAutomationIngestAuthorization(new Request("https://example.com", {
      headers: { authorization: "Bearer wrong-token" },
    }))).toThrow("Invalid automation ingest token");
  });

  it("rejects non-HTTP source links", () => {
    expect(() => granolaIngestSchema.parse({
      actions: [{
        externalReference: "meeting-123/action-1",
        title: "Unsafe action",
        sourceUrl: "javascript:alert(1)",
      }],
    })).toThrow();
  });
});
