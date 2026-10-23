import {
  buildShortcutPreview,
  buildShortcutPreviewForReferences,
  type ShortcutPreview,
} from "./shortcut-preview.js";
import {
  applyShortcutReconciliation,
  loadShortcutConnection,
  recordShortcutSyncFailure,
  updateShortcutConnectionMode,
  type ShortcutConnectionControlMode,
  type ShortcutConnectionSnapshot,
  type ShortcutSyncFailureState,
  type ShortcutSyncTrigger,
} from "./shortcut-repository.js";
import type { ShortcutPreviewItem } from "./shortcut-rule.js";
import {
  notifyShortcutChanges,
  notifyShortcutFailure,
  notifyShortcutRecovery,
} from "../push-notifications.js";
import { verifyInternalSyncSecret } from "./internal-sync.js";

export type AutomaticShortcutSyncInput = {
  trigger: Exclude<ShortcutSyncTrigger, "rule_change">;
  references?: string[];
};

export type AutomaticShortcutSyncResult = {
  outcome: "applied" | "ignored";
  applied: number;
};

type AutomaticSyncDependencies = {
  loadConnection: () => Promise<Pick<ShortcutConnectionSnapshot, "paused" | "syncMode"> & Partial<Pick<ShortcutConnectionSnapshot, "health">>>;
  preview: (references?: string[]) => Promise<Pick<ShortcutPreview, "items">>;
  apply: (items: ShortcutPreviewItem[], trigger: ShortcutSyncTrigger) => Promise<void>;
  recordFailure: (error: unknown, trigger: ShortcutSyncTrigger) => Promise<ShortcutSyncFailureState | void>;
  notifyChanges: (items: ShortcutPreviewItem[]) => Promise<void>;
  notifyFailure: (message: string) => Promise<void>;
  notifyRecovery: () => Promise<void>;
};

const defaultDependencies: AutomaticSyncDependencies = {
  loadConnection: loadShortcutConnection,
  preview: (references) => references
    ? buildShortcutPreviewForReferences(references)
    : buildShortcutPreview(),
  apply: applyShortcutReconciliation,
  recordFailure: recordShortcutSyncFailure,
  notifyChanges: notifyShortcutChanges,
  notifyFailure: notifyShortcutFailure,
  notifyRecovery: notifyShortcutRecovery,
};

export function verifyInternalShortcutSyncSecret(
  suppliedSecret: string,
  expectedSecret: string,
): boolean {
  return verifyInternalSyncSecret(suppliedSecret, expectedSecret);
}

export async function runAutomaticShortcutSync(
  input: AutomaticShortcutSyncInput,
  dependencies: Partial<AutomaticSyncDependencies> = {},
): Promise<AutomaticShortcutSyncResult> {
  const deps = { ...defaultDependencies, ...dependencies };
  const connection = await deps.loadConnection();
  if (connection.paused || connection.syncMode !== "automatic") {
    return { outcome: "ignored", applied: 0 };
  }

  try {
    const preview = await deps.preview(input.references);
    const items = preview.items.filter(({ action }) => action !== "ignore");
    await deps.apply(items, input.trigger);
    await deps.notifyChanges(items).catch((error) => console.error("Todo Trackr push notification error", error));
    if (connection.health === "degraded" || connection.health === "failed") {
      await deps.notifyRecovery().catch((error) => console.error("Todo Trackr recovery notification error", error));
    }
    return { outcome: "applied", applied: items.length };
  } catch (error) {
    const failure = await deps.recordFailure(error, input.trigger);
    if (failure?.shouldNotify) {
      await deps.notifyFailure(failure.message).catch((notificationError) => console.error("Todo Trackr failure notification error", notificationError));
    }
    throw error;
  }
}

export async function setShortcutConnectionControlMode(
  mode: ShortcutConnectionControlMode,
): Promise<ShortcutConnectionSnapshot> {
  await updateShortcutConnectionMode(mode);
  if (mode === "automatic") {
    await runAutomaticShortcutSync({ trigger: "resume" });
  }
  return loadShortcutConnection();
}
