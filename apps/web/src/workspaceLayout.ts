export type WorkspaceLayout = "standard" | "compact";

export const WORKSPACE_LAYOUT_STORAGE_KEY = "todo-trackr.workspace-layout";
export const MOBILE_WORKSPACE_MEDIA_QUERY = "(max-width: 700px)";

type LayoutStorage = Pick<Storage, "getItem" | "setItem">;

export function readWorkspaceLayout(storage: LayoutStorage): WorkspaceLayout {
  return storage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) === "compact" ? "compact" : "standard";
}

export function writeWorkspaceLayout(storage: LayoutStorage, layout: WorkspaceLayout): void {
  storage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, layout);
}

export function workspaceLayoutForViewport(
  preferredLayout: WorkspaceLayout,
  isMobileViewport: boolean,
): WorkspaceLayout {
  return isMobileViewport ? "compact" : preferredLayout;
}
