import { describe, expect, it } from "vitest";

import {
  resolveGranolaReviewCandidate,
  type GranolaLinkedTaskSource,
  type GranolaPriorReviewDecision,
} from "../netlify/functions/lib/automation/granola-repository.js";
import type { GranolaActionCandidate } from "../netlify/functions/lib/automation/granola-actions.js";

const candidate: GranolaActionCandidate = {
  externalReference: "not_123:action-2",
  title: "Send the rollout summary",
  notes: "From Granola meeting: Weekly product sync",
  sourceUrl: "https://notes.granola.ai/d/not_123",
  sourceExcerpt: "Send the rollout summary (Kyle)",
  dueAt: null,
  sourceUpdatedAt: "2026-08-17T17:00:00Z",
  responsibility: "explicit",
};

describe("Granola review deduplication", () => {
  it("preserves a dismissal when the same action moves to a different bullet", () => {
    const decisions: GranolaPriorReviewDecision[] = [{
      id: "not_123:action-1",
      title: candidate.title,
      sourceExcerpt: candidate.sourceExcerpt,
      status: "dismissed",
      resolvedAt: "2026-08-17T16:00:00Z",
    }];

    expect(resolveGranolaReviewCandidate(candidate, decisions, [])).toEqual({
      status: "dismissed",
      resolvedAt: "2026-08-17T16:00:00Z",
    });
  });

  it("treats an action with an existing Task as already accepted", () => {
    const linkedSources: GranolaLinkedTaskSource[] = [{
      externalReference: "not_123:action-1",
      title: candidate.title,
      sourceUrl: candidate.sourceUrl,
    }];

    expect(resolveGranolaReviewCandidate(candidate, [], linkedSources)).toEqual({
      status: "accepted",
      resolvedAt: expect.any(String),
    });
  });

  it("leaves a genuinely new action pending", () => {
    expect(resolveGranolaReviewCandidate(candidate, [], [])).toEqual({
      status: "pending",
      resolvedAt: null,
    });
  });
});
