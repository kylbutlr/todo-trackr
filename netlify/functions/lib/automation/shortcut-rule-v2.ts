import { createHash } from "node:crypto";

import { z } from "zod";

import {
  ACTIVE_SHORTCUT_STATES,
  COMPLETION_SHORTCUT_STATES,
  KYLE_SHORTCUT_MEMBER_ID,
  normalizeShortcutStory,
  shortcutStorySchema,
  type ShortcutStory,
} from "./shortcut-rule.js";

export const SHORTCUT_RULE_V2_VERSION = 2;

export const HOLD_SHORTCUT_STATES = {
  500130165: "Agentic QA",
  500130660: "QA In Progress",
} as const;

export const SHORTCUT_RULE_V2_COMPLETION_STATES = Object.fromEntries(
  Object.entries(COMPLETION_SHORTCUT_STATES).filter(([id]) => !Object.hasOwn(HOLD_SHORTCUT_STATES, id)),
) as Record<string, string>;

export const shortcutCommentSchema = z.object({
  id: z.number().int().positive(),
  app_url: z.url().nullable().optional(),
  author_id: z.string().nullable().default(null),
  member_mention_ids: z.array(z.string()).default([]),
  parent_id: z.number().int().positive().nullable().default(null),
  text: z.string().nullable().default(null),
  deleted: z.boolean().default(false),
  created_at: z.string().min(1),
  updated_at: z.string().nullable().default(null),
});

export type ShortcutComment = z.infer<typeof shortcutCommentSchema>;
export type ShortcutResponsibilityReasonKind = "assigned" | "requester" | "description_request" | "comment_request";
export type ShortcutResponsibilityReason = {
  id: string;
  kind: ShortcutResponsibilityReasonKind;
  label: string;
  active: boolean;
  userCompletable: boolean;
  sourceExcerpt: string | null;
  sourceUrl: string;
  completionSignal: string | null;
};
export type ShortcutRuleV2Outcome = "open" | "hold" | "complete" | "ignore";
export type ShortcutRuleV2Salience = "primary" | "heads_up" | "background";
export type ShortcutRuleV2ShadowItem = {
  externalReference: string;
  sourceUrl: string;
  title: string;
  workflowStateName: string;
  outcome: ShortcutRuleV2Outcome;
  salience: ShortcutRuleV2Salience;
  reasons: ShortcutResponsibilityReason[];
  reasonSummary: string;
  sourceUpdatedAt: string | null;
  fingerprint: string;
};

function normalizedExcerpt(text: string | null): string | null {
  const value = text?.replace(/\s+/gu, " ").trim();
  if (!value) return null;
  return value.length <= 280 ? value : `${value.slice(0, 277).trimEnd()}...`;
}

function hasDirectRequestLanguage(text: string): boolean {
  return /\b(?:please|can you|could you|will you|would you|needs? to|follow up|review|respond|reply|confirm|send|check|handle|update|provide|investigate|approve|qa|test)\b/iu.test(text);
}

function laterKyleResponse(request: ShortcutComment, comments: ShortcutComment[]): ShortcutComment | undefined {
  const requestTime = Date.parse(request.created_at);
  return comments.find((comment) => {
    if (comment.deleted || comment.author_id !== KYLE_SHORTCUT_MEMBER_ID) return false;
    if (Date.parse(comment.created_at) <= requestTime) return false;
    if (request.parent_id !== null) return comment.parent_id === request.parent_id;
    return comment.parent_id === request.id || comment.parent_id === null;
  });
}

function stateKind(workflowStateId: number | null): "active" | "hold" | "completion" | "other" {
  if (workflowStateId === null) return "other";
  if (Object.hasOwn(ACTIVE_SHORTCUT_STATES, workflowStateId)) return "active";
  if (Object.hasOwn(HOLD_SHORTCUT_STATES, workflowStateId)) return "hold";
  if (Object.hasOwn(SHORTCUT_RULE_V2_COMPLETION_STATES, workflowStateId)) return "completion";
  return "other";
}

export function evaluateShortcutRuleV2(
  storyInput: ShortcutStory,
  commentInputs: ShortcutComment[] = [],
): ShortcutRuleV2ShadowItem {
  const story = shortcutStorySchema.parse(storyInput);
  const observation = normalizeShortcutStory(story);
  const comments = commentInputs.map((comment) => shortcutCommentSchema.parse(comment));
  const state = stateKind(story.workflow_state_id);
  const reasons: ShortcutResponsibilityReason[] = [];

  if (story.owner_ids.includes(KYLE_SHORTCUT_MEMBER_ID)) {
    reasons.push({
      id: "assigned",
      kind: "assigned",
      label: "Assigned to Kyle",
      active: state !== "completion" && !story.archived,
      userCompletable: false,
      sourceExcerpt: null,
      sourceUrl: story.app_url,
      completionSignal: state === "completion" ? observation.workflowStateName : null,
    });
  }

  if (story.requested_by_id === KYLE_SHORTCUT_MEMBER_ID) {
    reasons.push({
      id: "requester",
      kind: "requester",
      label: "Requested by Kyle",
      active: state !== "completion" && !story.archived,
      userCompletable: false,
      sourceExcerpt: null,
      sourceUrl: story.app_url,
      completionSignal: state === "completion" ? observation.workflowStateName : null,
    });
  }

  if (
    (story.member_mention_ids ?? []).includes(KYLE_SHORTCUT_MEMBER_ID)
    && hasDirectRequestLanguage(story.description)
  ) {
    reasons.push({
      id: "description-request",
      kind: "description_request",
      label: "Heads Up from description",
      active: state !== "completion" && !story.archived,
      userCompletable: true,
      sourceExcerpt: normalizedExcerpt(story.description),
      sourceUrl: story.app_url,
      completionSignal: state === "completion" ? observation.workflowStateName : null,
    });
  }

  for (const comment of comments) {
    if (
      comment.deleted
      || comment.author_id === KYLE_SHORTCUT_MEMBER_ID
      || !comment.member_mention_ids.includes(KYLE_SHORTCUT_MEMBER_ID)
      || !comment.text
      || !hasDirectRequestLanguage(comment.text)
    ) continue;
    const response = laterKyleResponse(comment, comments);
    const completedBySource = state === "completion" || story.archived || response !== undefined;
    reasons.push({
      id: `comment:${comment.id}`,
      kind: "comment_request",
      label: "Heads Up from comment",
      active: !completedBySource,
      userCompletable: true,
      sourceExcerpt: normalizedExcerpt(comment.text),
      sourceUrl: comment.app_url ?? story.app_url,
      completionSignal: response
        ? `Kyle responded on ${new Date(response.created_at).toISOString()}`
        : state === "completion" ? observation.workflowStateName : story.archived ? "Story archived" : null,
    });
  }

  const activeReasons = reasons.filter(({ active }) => active);
  const hasAssigned = activeReasons.some(({ kind }) => kind === "assigned");
  const hasHeadsUp = activeReasons.some(({ kind }) => kind === "description_request" || kind === "comment_request");
  const salience: ShortcutRuleV2Salience = hasAssigned ? "primary" : hasHeadsUp ? "heads_up" : "background";
  const outcome: ShortcutRuleV2Outcome = story.archived
    ? "ignore"
    : state === "completion" && reasons.length > 0
      ? "complete"
      : activeReasons.length === 0
        ? reasons.length > 0 ? "complete" : "ignore"
        : state === "hold"
          ? "hold"
          : state === "active" || hasHeadsUp
            ? "open"
            : "ignore";
  const reasonSummary = activeReasons.length > 0
    ? activeReasons.map(({ label }) => label).join(" + ")
    : reasons.length > 0 ? "All Responsibility Reasons are satisfied" : "No Responsibility Reason matched";
  const fingerprint = createHash("sha256").update(JSON.stringify({
    outcome,
    salience,
    workflowStateId: story.workflow_state_id,
    reasons: reasons.map(({ id, active, completionSignal }) => ({ id, active, completionSignal })),
    sourceUpdatedAt: observation.sourceUpdatedAt,
  })).digest("hex");

  return {
    externalReference: observation.externalReference,
    sourceUrl: observation.sourceUrl,
    title: observation.title,
    workflowStateName: observation.workflowStateName,
    outcome,
    salience,
    reasons,
    reasonSummary,
    sourceUpdatedAt: observation.sourceUpdatedAt,
    fingerprint,
  };
}
