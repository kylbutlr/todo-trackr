import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  MOBILE_WORKSPACE_MEDIA_QUERY,
  readWorkspaceLayout,
  WORKSPACE_LAYOUT_STORAGE_KEY,
  workspaceLayoutForViewport,
  writeWorkspaceLayout,
} from "../apps/web/src/workspaceLayout.js";

function storage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(WORKSPACE_LAYOUT_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("Workspace layout", () => {
  it("defaults unknown and missing preferences to Standard", () => {
    expect(readWorkspaceLayout(storage())).toBe("standard");
    expect(readWorkspaceLayout(storage("unknown"))).toBe("standard");
  });

  it("persists Compact mode on the current browser", () => {
    const preference = storage();
    writeWorkspaceLayout(preference, "compact");
    expect(readWorkspaceLayout(preference)).toBe("compact");
  });

  it("always uses Compact on mobile without changing the desktop preference", () => {
    expect(MOBILE_WORKSPACE_MEDIA_QUERY).toBe("(max-width: 700px)");
    expect(workspaceLayoutForViewport("standard", true)).toBe("compact");
    expect(workspaceLayoutForViewport("standard", false)).toBe("standard");
    expect(workspaceLayoutForViewport("compact", false)).toBe("compact");
  });

  it("uses a full-viewport detail panel in Compact mode", () => {
    const application = readFileSync(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../apps/web/src/styles.css", import.meta.url), "utf8");

    expect(application).toContain('className={`workspace is-${effectiveWorkspaceLayout}');
    expect(application).toContain('compact={effectiveWorkspaceLayout === "compact"}');
    expect(styles).toContain(".workspace.is-compact .detail-overlay.is-open");
    expect(styles).toContain("grid-template-columns: 56px minmax(0, 1fr)");
    expect(styles).not.toContain("@media (max-width: 459px)");
    expect(styles).toContain("min-height: 100dvh");

    const compactWorkspaceRule = styles.match(/\.workspace\.is-compact\s*\{([^}]*)\}/u)?.[1];
    expect(compactWorkspaceRule).toContain("display: grid");
  });

  it("uses a persisted list-or-detail flow in the native app", () => {
    const workspace = readFileSync(
      new URL("../apps/macos/Sources/Views/WorkspaceView.swift", import.meta.url),
      "utf8",
    );
    const taskList = readFileSync(
      new URL("../apps/macos/Sources/Views/TaskListView.swift", import.meta.url),
      "utf8",
    );
    const application = readFileSync(
      new URL("../apps/macos/Sources/TodoTrackerApp.swift", import.meta.url),
      "utf8",
    );

    expect(workspace).toContain('@AppStorage("todo-trackr.workspace-layout")');
    expect(workspace).toContain("NavigationStack");
    expect(workspace).toContain("compactSidebarRail");
    expect(workspace).not.toContain("let showsRail = geometry.size.width >= 460");
    expect(workspace).toContain("automaticallySelectFirstTask: false");
    expect(workspace).toContain("isCompact: true");
    expect(taskList).toContain("var automaticallySelectFirstTask = true");
    expect(application).toContain(".frame(minWidth: 380, minHeight: 620)");
  });

  it("keeps a fixed Compact icon rail and usable mobile task controls", () => {
    const styles = readFileSync(new URL("../apps/web/src/styles.css", import.meta.url), "utf8");
    const workspace = readFileSync(
      new URL("../apps/macos/Sources/Views/WorkspaceView.swift", import.meta.url),
      "utf8",
    );

    expect(styles).not.toContain(".workspace { display: block; }");
    expect(styles).not.toContain(".list-section nav { display: flex; overflow-x: auto; }");
    expect(styles).not.toContain("@media (max-width: 459px)");
    expect(styles).not.toContain("grid-template-columns: 200px 1fr");
    expect(styles).toContain("grid-template-columns: 48px minmax(0, 1fr)");
    expect(styles).toContain(".workspace.is-compact .task-tools > input");
    expect(styles).toContain("font-size: 16px");
    expect(workspace).not.toContain("let showsRail = geometry.size.width >= 460");
  });

  it("keeps the empty detail prompt near the top of the visible column", () => {
    const styles = readFileSync(new URL("../apps/web/src/styles.css", import.meta.url), "utf8");
    const emptyDetailRule = styles.match(/\.empty-detail\s*\{([^}]*)\}/u)?.[1];

    expect(emptyDetailRule).toContain("justify-content: flex-start");
    expect(emptyDetailRule).toContain("padding-top: clamp(96px, 18vh, 180px)");
  });
});
