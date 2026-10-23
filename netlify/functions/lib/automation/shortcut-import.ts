import { HttpError } from "../http.js";
import { applyShortcutReconciliation } from "./shortcut-repository.js";
import { buildShortcutPreview } from "./shortcut-preview.js";

export type ShortcutImportResult = {
  imported: number;
  connectionPaused: boolean;
};

type ImportDependencies = {
  preview: typeof buildShortcutPreview;
  apply: typeof applyShortcutReconciliation;
};

const defaultDependencies: ImportDependencies = {
  preview: buildShortcutPreview,
  apply: applyShortcutReconciliation,
};

export async function importInitialShortcutTasks(
  approvalToken: string,
  dependencies: Partial<ImportDependencies> = {},
): Promise<ShortcutImportResult> {
  const deps = { ...defaultDependencies, ...dependencies };
  const preview = await deps.preview();

  if (preview.connection.controlMode !== "review") {
    throw new HttpError(409, "Set Shortcut to Review before running an initial import.");
  }
  if (!preview.initialImport.allowed || !preview.initialImport.approvalToken) {
    throw new HttpError(409, "The initial Shortcut import is no longer available. Refresh the preview.");
  }
  if (preview.initialImport.approvalToken !== approvalToken) {
    throw new HttpError(409, "Shortcut changed after this preview. Refresh before importing.");
  }

  const items = preview.items.filter(({ action }) => action === "create");
  await deps.apply(items);

  return {
    imported: items.length,
    connectionPaused: preview.connection.paused,
  };
}
