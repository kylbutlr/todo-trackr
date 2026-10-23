import { HttpError } from "../http.js";
import { buildShortcutPreview } from "./shortcut-preview.js";
import { applyShortcutReconciliation } from "./shortcut-repository.js";
import type { ShortcutPreviewAction } from "./shortcut-rule.js";

const appliedActions: ShortcutPreviewAction[] = ["create", "update", "complete", "reopen", "archive"];

export type ShortcutReconcileResult = {
  applied: number;
  counts: Record<Exclude<ShortcutPreviewAction, "ignore">, number>;
  connectionPaused: boolean;
};

type ReconcileDependencies = {
  preview: typeof buildShortcutPreview;
  apply: typeof applyShortcutReconciliation;
};

const defaultDependencies: ReconcileDependencies = {
  preview: buildShortcutPreview,
  apply: applyShortcutReconciliation,
};

export async function applyApprovedShortcutChanges(
  approvalToken: string,
  dependencies: Partial<ReconcileDependencies> = {},
): Promise<ShortcutReconcileResult> {
  const deps = { ...defaultDependencies, ...dependencies };
  const preview = await deps.preview();

  if (!preview.approval.allowed || !preview.approval.token) {
    throw new HttpError(409, "There are no Shortcut changes to apply. Refresh the preview.");
  }
  if (preview.approval.token !== approvalToken) {
    throw new HttpError(409, "Shortcut changed after this preview. Refresh before applying changes.");
  }

  const items = preview.items.filter(({ action }) => action !== "ignore");
  await deps.apply(items);

  const counts = Object.fromEntries(appliedActions.map((action) => [
    action,
    items.filter((item) => item.action === action).length,
  ])) as ShortcutReconcileResult["counts"];

  return {
    applied: items.length,
    counts,
    connectionPaused: preview.connection.paused,
  };
}
