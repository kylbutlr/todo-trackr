import { ShortcutClient, type ShortcutStorySet } from "./shortcut-client.js";
import { loadShortcutPreviewContext } from "./shortcut-repository.js";
import {
  loadShortcutRuleV2Shadow,
  recordShortcutRuleV2Shadow,
  type ShortcutRuleV2ShadowSnapshot,
} from "./shortcut-shadow-repository.js";
import {
  evaluateShortcutRuleV2,
  type ShortcutComment,
  type ShortcutRuleV2ShadowItem,
} from "./shortcut-rule-v2.js";
import { KYLE_SHORTCUT_MEMBER_ID } from "./shortcut-rule.js";

type ShortcutRuleV2ShadowDependencies = {
  existingReferences: () => Promise<string[]>;
  observeCandidates: (existingReferences: string[]) => Promise<ShortcutStorySet>;
  observeReferences: (references: string[]) => Promise<ShortcutStorySet>;
  observeComments: (reference: string) => Promise<ShortcutComment[]>;
  record: typeof recordShortcutRuleV2Shadow;
  load: typeof loadShortcutRuleV2Shadow;
};

const defaultDependencies: ShortcutRuleV2ShadowDependencies = {
  existingReferences: async () => {
    const context = await loadShortcutPreviewContext();
    return context.existingTasks.map(({ externalReference }) => externalReference);
  },
  observeCandidates: (existingReferences) => new ShortcutClient()
    .observeRuleV2CandidateStories(KYLE_SHORTCUT_MEMBER_ID, existingReferences),
  observeReferences: (references) => new ShortcutClient().observeStoriesByReferences(references),
  observeComments: (reference) => new ShortcutClient().observeStoryComments(reference),
  record: recordShortcutRuleV2Shadow,
  load: loadShortcutRuleV2Shadow,
};

export async function evaluateShortcutRuleV2Stories(
  observed: ShortcutStorySet,
  observeComments: ShortcutRuleV2ShadowDependencies["observeComments"],
): Promise<ShortcutRuleV2ShadowItem[]> {
  return Promise.all(observed.stories.map(async (story) => evaluateShortcutRuleV2(
    story,
    await observeComments(String(story.id)),
  )));
}

export async function refreshShortcutRuleV2Shadow(
  references?: string[],
  dependencies: Partial<ShortcutRuleV2ShadowDependencies> = {},
): Promise<ShortcutRuleV2ShadowSnapshot> {
  const deps = { ...defaultDependencies, ...dependencies };
  const observed = references
    ? await deps.observeReferences([...new Set(references)])
    : await deps.observeCandidates(await deps.existingReferences());
  const items = await evaluateShortcutRuleV2Stories(observed, deps.observeComments);
  await deps.record(items);
  return deps.load();
}
