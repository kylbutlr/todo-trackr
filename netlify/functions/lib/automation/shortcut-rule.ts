import { createHash } from "node:crypto";

import { z } from "zod";

export const SHORTCUT_CONNECTION_ID = "00000000-0000-4000-8000-000000000100";
export const DIRECT_SHORTCUT_RULE_ID = "00000000-0000-4000-8000-000000000110";
export const DIRECT_SHORTCUT_RULE_VERSION = 1;
export const KYLE_SHORTCUT_MEMBER_ID = "5d8264c4-151d-48ca-9f1a-ed042cf4780f";
export const SHORTCUT_PRIORITY_FIELD_ID = "6260481e-f3fd-462d-b865-5cd73ef89989";
export const SHORTCUT_SIZE_FIELD_ID = "6a57ae0b-afbe-47d1-8ac7-964dbeb8b9a7";

export const ACTIVE_SHORTCUT_STATES = {
  500130360: "Triage",
  500130669: "Triage In Progress",
  500130177: "Ready for LOE",
  500000056: "Ready for Development",
  500000051: "In Progress",
  500127059: "Pending Eng",
} as const;

export const COMPLETION_SHORTCUT_STATES = {
  500019424: "Pending Ops",
  500130176: "Pending Client",
  500130165: "Agentic QA",
  500130660: "QA In Progress",
  500130980: "CSM Review",
  500000081: "QA in Staging",
  500000079: "Production Approved",
  500058674: "Deployed",
  500000055: "Completed",
} as const;

export type ShortcutStateMap = Record<string, string>;
export type ShortcutRuleSettings = {
  version: number;
  activeStates: ShortcutStateMap;
  completionStates: ShortcutStateMap;
  stateNames?: ShortcutStateMap;
};

export const DEFAULT_SHORTCUT_RULE_SETTINGS: ShortcutRuleSettings = {
  version: DIRECT_SHORTCUT_RULE_VERSION,
  activeStates: ACTIVE_SHORTCUT_STATES,
  completionStates: COMPLETION_SHORTCUT_STATES,
};

const shortcutCustomFieldSchema = z.object({
  field_id: z.string(),
  value: z.string().nullable().optional(),
  value_id: z.string().nullable().optional(),
});

export const shortcutStorySchema = z.object({
  id: z.number().int().positive(),
  app_url: z.url(),
  archived: z.boolean().default(false),
  name: z.string().trim().min(1),
  description: z.string().default(""),
  owner_ids: z.array(z.string()).default([]),
  requested_by_id: z.string().nullable().optional(),
  epic_id: z.number().int().positive().nullable().optional(),
  epic_name: z.string().trim().min(1).nullable().optional(),
  member_mention_ids: z.array(z.string()).optional(),
  created_at: z.string().nullable().optional(),
  workflow_state_id: z.number().int().nullable(),
  custom_fields: z.array(shortcutCustomFieldSchema).default([]),
  deadline: z.string().nullable().default(null),
  updated_at: z.string().nullable().optional(),
});

export type ShortcutStory = z.infer<typeof shortcutStorySchema>;
export type ShortcutPriority = "none" | "lowest" | "low" | "medium" | "high" | "highest";
export type ShortcutSize = "S" | "M" | "L" | "XL" | null;
export type AutomatedTaskLifecycle = "open" | "completed" | "archived";
export type ShortcutPreviewAction = "create" | "update" | "complete" | "reopen" | "archive" | "ignore";

export type ExistingShortcutTask = {
  taskId: string;
  externalReference: string;
  lifecycle: AutomatedTaskLifecycle;
  sourceFingerprint: string;
  summaryFingerprint: string | null;
  sourceSummary: string | null;
};

export type ShortcutObservation = {
  externalReference: string;
  sourceUrl: string;
  title: string;
  description: string;
  contentFingerprint: string;
  sourceFingerprint: string;
  priority: ShortcutPriority;
  size: ShortcutSize;
  dueDate: string | null;
  ownerIds: string[];
  epicId: number | null;
  epicName: string | null;
  workflowStateId: number | null;
  workflowStateName: string;
  archived: boolean;
  sourceUpdatedAt: string | null;
};

export type ShortcutPreviewItem = ShortcutObservation & {
  ruleVersion?: number;
  taskId: string | null;
  currentLifecycle: AutomatedTaskLifecycle | null;
  action: ShortcutPreviewAction;
  reason: string;
  needsSummary: boolean;
  sourceSummary: string | null;
};

const shortcutPriorityByValue: Record<string, ShortcutPriority> = {
  highest: "highest",
  high: "high",
  medium: "medium",
  low: "low",
  lowest: "lowest",
  p0: "highest",
  p1: "high",
  p2: "medium",
  p3: "low",
  p4: "lowest",
};

const shortcutPriorityByValueId: Record<string, ShortcutPriority> = {
  "6260481e-ff6c-406e-bf5a-fa3f4febcc57": "highest",
  "6260481e-028f-4be7-9d97-0c46f05a0c80": "high",
  "6260481e-4ce5-4a4e-a743-086db52fdec6": "medium",
  "6260481e-8499-4e2b-88b9-c81de43fbaa5": "low",
  "6260481e-12cc-4cca-9ba5-3a23c5d0bab2": "lowest",
};

const shortcutSizeByValueId: Record<string, Exclude<ShortcutSize, null>> = {
  "6a57ae0b-0e32-4b62-8ea0-807b01c2de73": "S",
  "6a57ae0b-0240-47d8-a1fc-63017a6fc338": "M",
  "6a57ae0b-05dc-4983-8ccb-ebaa0c7deaea": "L",
  "6a57ae0b-6719-4e86-bd0b-ac61ae139e8c": "XL",
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function customField(story: ShortcutStory, fieldId: string) {
  return story.custom_fields.find((field) => field.field_id === fieldId);
}

function priorityFor(story: ShortcutStory): ShortcutPriority {
  const field = customField(story, SHORTCUT_PRIORITY_FIELD_ID);
  const value = field?.value?.trim().toLocaleLowerCase();
  return (value ? shortcutPriorityByValue[value] : undefined)
    ?? (field?.value_id ? shortcutPriorityByValueId[field.value_id] : undefined)
    ?? "none";
}

function sizeFor(story: ShortcutStory): ShortcutSize {
  const field = customField(story, SHORTCUT_SIZE_FIELD_ID);
  const value = field?.value?.trim().toLocaleUpperCase();
  if (value === "S" || value === "M" || value === "L" || value === "XL") return value;
  return field?.value_id ? shortcutSizeByValueId[field.value_id] ?? null : null;
}

function calendarDate(value: string | null): string | null {
  if (!value) return null;
  const sourceCalendarDate = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/u)?.[1];
  if (sourceCalendarDate) return sourceCalendarDate;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function stateName(id: number | null, rule: ShortcutRuleSettings): string {
  if (id === null) return "Unknown";
  return rule.stateNames?.[id]
    ?? rule.activeStates[id]
    ?? rule.completionStates[id]
    ?? (id === 500134189 ? "Engineering Triage" : undefined)
    ?? `State ${id}`;
}

export function normalizeShortcutStory(storyInput: ShortcutStory, rule = DEFAULT_SHORTCUT_RULE_SETTINGS): ShortcutObservation {
  const story = shortcutStorySchema.parse(storyInput);
  const priority = priorityFor(story);
  const size = sizeFor(story);
  const dueDate = calendarDate(story.deadline);
  const workflowStateName = stateName(story.workflow_state_id, rule);
  const contentFingerprint = hash({ title: story.name, description: story.description });
  const sourceFingerprint = hash({
    title: story.name,
    contentFingerprint,
    priority,
    size,
    dueDate,
    ownerIds: story.owner_ids.toSorted(),
    epicId: story.epic_id ?? null,
    epicName: story.epic_name ?? null,
    workflowStateId: story.workflow_state_id,
    workflowStateName,
    archived: story.archived,
  });

  return {
    externalReference: String(story.id),
    sourceUrl: story.app_url,
    title: story.name,
    description: story.description,
    contentFingerprint,
    sourceFingerprint,
    priority,
    size,
    dueDate,
    ownerIds: story.owner_ids,
    epicId: story.epic_id ?? null,
    epicName: story.epic_name ?? null,
    workflowStateId: story.workflow_state_id,
    workflowStateName,
    archived: story.archived,
    sourceUpdatedAt: story.updated_at ?? null,
  };
}

function previewDecision(
  observation: ShortcutObservation,
  existing: ExistingShortcutTask | undefined,
  rule: ShortcutRuleSettings,
): Pick<ShortcutPreviewItem, "action" | "reason"> {
  const assigned = observation.ownerIds.includes(KYLE_SHORTCUT_MEMBER_ID);
  const active = observation.workflowStateId !== null
    && Object.hasOwn(rule.activeStates, observation.workflowStateId);
  const completion = !active && observation.workflowStateId !== null
    && Object.hasOwn(rule.completionStates, observation.workflowStateId);

  if (observation.archived) {
    if (existing?.lifecycle === "open") {
      return { action: "archive", reason: "Shortcut archived the story, so the Source is unavailable." };
    }
    return { action: "ignore", reason: "The Shortcut story is archived and has no active Task." };
  }

  if (completion) {
    if (!existing) {
      return { action: "ignore", reason: `${observation.workflowStateName} ends the Responsibility, so no new Task is needed.` };
    }
    if (existing.lifecycle === "archived") {
      return { action: "ignore", reason: "The Responsibility was already archived before someone else completed the story." };
    }
    if (existing.lifecycle === "open") {
      return { action: "complete", reason: `${observation.workflowStateName} is a configured Completion Signal.` };
    }
    return existing.sourceFingerprint === observation.sourceFingerprint
      ? { action: "ignore", reason: "The completed Task already matches Shortcut." }
      : { action: "update", reason: "Shortcut metadata changed after completion." };
  }

  if (active && assigned) {
    if (!existing) {
      return { action: "create", reason: `Kyle is assigned and ${observation.workflowStateName} is actionable.` };
    }
    if (existing.lifecycle !== "open") {
      return { action: "reopen", reason: `The Responsibility returned in ${observation.workflowStateName}.` };
    }
    return existing.sourceFingerprint === observation.sourceFingerprint
      ? { action: "ignore", reason: "The open Task already matches Shortcut." }
      : { action: "update", reason: "Shortcut-owned fields changed." };
  }

  if (existing?.lifecycle === "open") {
    return assigned
      ? { action: "archive", reason: `${observation.workflowStateName} is not actionable for this Rule Version.` }
      : { action: "archive", reason: "Kyle is no longer assigned to the Shortcut story." };
  }

  return { action: "ignore", reason: assigned ? "The Shortcut state is not actionable." : "Kyle is not assigned." };
}

export function previewShortcutStory(
  story: ShortcutStory,
  existing?: ExistingShortcutTask,
  rule = DEFAULT_SHORTCUT_RULE_SETTINGS,
): ShortcutPreviewItem {
  const observation = normalizeShortcutStory(story, rule);
  const decision = previewDecision(observation, existing, rule);
  const needsSummary = decision.action !== "ignore"
    && observation.contentFingerprint !== existing?.summaryFingerprint;

  return {
    ...observation,
    taskId: existing?.taskId ?? null,
    currentLifecycle: existing?.lifecycle ?? null,
    ...decision,
    needsSummary,
    sourceSummary: existing?.sourceSummary ?? null,
  };
}
