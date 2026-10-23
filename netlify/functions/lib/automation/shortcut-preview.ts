import { createHash } from "node:crypto";

import { loadCurrentShortcutRuleSettings } from "./shortcut-settings.js";
import { ShortcutClient } from "./shortcut-client.js";
import { generateSourceExcerpts, type SourceExcerptInput } from "./source-excerpts.js";
import { loadShortcutPreviewContext } from "./shortcut-repository.js";
import {
  DIRECT_SHORTCUT_RULE_ID,
  type ShortcutRuleSettings,
  type ShortcutStateMap,
  KYLE_SHORTCUT_MEMBER_ID,
  previewShortcutStory,
  type ExistingShortcutTask,
  type ShortcutPreviewAction,
  type ShortcutPreviewItem,
} from "./shortcut-rule.js";

export type ShortcutPreview = {
  mode: "preview";
  generatedAt: string;
  connection: Awaited<ReturnType<typeof loadShortcutPreviewContext>>["connection"];
  rule: {
    id: string;
    version: number;
    name: string;
    activeStates: ShortcutStateMap;
    completionStates: ShortcutStateMap;
  };
  counts: Record<ShortcutPreviewAction, number>;
  items: ShortcutPreviewItem[];
  evaluatedCount: number;
  initialImport: {
    allowed: boolean;
    approvalToken: string | null;
  };
  approval: {
    allowed: boolean;
    token: string | null;
  };
};

export type PreviewDependencies = {
  loadContext: typeof loadShortcutPreviewContext;
  loadRule: () => Promise<ShortcutRuleSettings>;
  observeStories: (existingReferences: string[], activeStates: ShortcutStateMap) => ReturnType<ShortcutClient["observeOwnedStories"]>;
  describeSources: (inputs: SourceExcerptInput[]) => Promise<Array<string | null>>;
  now: () => Date;
};

const defaultDependencies: PreviewDependencies = {
  loadContext: loadShortcutPreviewContext,
  loadRule: loadCurrentShortcutRuleSettings,
  observeStories: (existingReferences, activeStates) => new ShortcutClient()
    .observeOwnedStories(KYLE_SHORTCUT_MEMBER_ID, existingReferences, activeStates),
  describeSources: generateSourceExcerpts,
  now: () => new Date(),
};

const actionOrder: ShortcutPreviewAction[] = ["create", "reopen", "complete", "archive", "update", "ignore"];

function approvalTokenFor(items: ShortcutPreviewItem[], rule: ShortcutRuleSettings): string {
  return createHash("sha256").update(JSON.stringify([rule, items.map((item) => ({
    action: item.action,
    externalReference: item.externalReference,
    sourceFingerprint: item.sourceFingerprint,
    sourceSummary: item.sourceSummary,
  }))])).digest("hex");
}

function unavailablePreview(existing: ExistingShortcutTask): ShortcutPreviewItem | undefined {
  if (existing.lifecycle !== "open") return undefined;
  return {
    externalReference: existing.externalReference,
    sourceUrl: `https://app.shortcut.com/sdg/story/${existing.externalReference}`,
    title: `SC-${existing.externalReference}`,
    description: "",
    contentFingerprint: existing.summaryFingerprint ?? "",
    sourceFingerprint: existing.sourceFingerprint,
    priority: "none",
    size: null,
    dueDate: null,
    ownerIds: [],
    epicId: null,
    epicName: null,
    workflowStateId: null,
    workflowStateName: "Unavailable",
    archived: true,
    sourceUpdatedAt: null,
    taskId: existing.taskId,
    currentLifecycle: existing.lifecycle,
    action: "archive",
    reason: "Shortcut confirmed that the Source is unavailable.",
    needsSummary: false,
    sourceSummary: existing.sourceSummary,
  };
}
export async function buildShortcutPreview(
  dependencies: Partial<PreviewDependencies> = {},
): Promise<ShortcutPreview> {
  const deps = { ...defaultDependencies, ...dependencies };
  const rule = await deps.loadRule();
  const effectiveRule = {
    ...rule,
    completionStates: Object.fromEntries(
      Object.entries(rule.completionStates).filter(([id]) => !Object.hasOwn(rule.activeStates, id)),
    ),
  };
  const { connection, existingTasks } = await deps.loadContext();
  const existingByReference = new Map(existingTasks.map((task) => [task.externalReference, task]));
  const observed = await deps.observeStories(existingTasks.map(({ externalReference }) => externalReference), rule.activeStates);

  const items = observed.stories.map((story) => previewShortcutStory(
    story,
    existingByReference.get(String(story.id)),
    effectiveRule,
  ));
  for (const reference of observed.unavailableReferences) {
    const existing = existingByReference.get(reference);
    const preview = existing ? unavailablePreview(existing) : undefined;
    if (preview) items.push(preview);
  }

  for (const item of items) item.ruleVersion = rule.version;

  const pendingSummaries = items.filter(({ needsSummary }) => needsSummary);
  if (pendingSummaries.length > 0) {
    const excerpts = await deps.describeSources(
      pendingSummaries.map(({ title, description }) => ({ title, description })),
    );
    pendingSummaries.forEach((item, index) => {
      item.sourceSummary = excerpts[index];
    });
  }

  items.sort((left, right) => {
    const actionDifference = actionOrder.indexOf(left.action) - actionOrder.indexOf(right.action);
    return actionDifference || Number(left.externalReference) - Number(right.externalReference);
  });

  const counts = Object.fromEntries(actionOrder.map((action) => [
    action,
    items.filter((item) => item.action === action).length,
  ])) as Record<ShortcutPreviewAction, number>;
  const proposedItems = items.filter(({ action }) => action !== "ignore");
  const initialImportAllowed = connection.controlMode === "review"
    && existingTasks.length === 0
    && proposedItems.length > 0
    && proposedItems.every(({ action }) => action === "create");
  const approvalToken = proposedItems.length > 0 ? approvalTokenFor(proposedItems, rule) : null;

  return {
    mode: "preview",
    generatedAt: deps.now().toISOString(),
    connection,
    rule: {
      id: DIRECT_SHORTCUT_RULE_ID,
      version: rule.version,
      name: "Direct Shortcut Responsibility",
      activeStates: rule.activeStates,
      completionStates: effectiveRule.completionStates,
    },
    counts,
    items,
    evaluatedCount: items.length,
    initialImport: {
      allowed: initialImportAllowed,
      approvalToken: initialImportAllowed ? approvalToken : null,
    },
    approval: {
      allowed: proposedItems.length > 0,
      token: approvalToken,
    },
  };
}

export async function buildShortcutPreviewForReferences(
  references: string[],
  dependencies: Partial<PreviewDependencies> = {},
): Promise<ShortcutPreview> {
  const uniqueReferences = [...new Set(references)];
  return buildShortcutPreview({
    ...dependencies,
    observeStories: () => new ShortcutClient().observeStoriesByReferences(uniqueReferences),
  });
}
