import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../", import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, repositoryRoot), "utf8");
}

describe("Shortcut Task source indicator", () => {
  it("uses a source link instead of a disabled completion circle on the web", () => {
    const app = source("apps/web/src/App.tsx");
    const styles = source("apps/web/src/styles.css");

    expect(app).toContain('className="task-source-indicator"');
    expect(app).toContain("href={task.sourceUrl}");
    expect(app).toContain("Open ${sourceReference} in Shortcut");
    expect(app).toContain("task-source-reference");
    expect(styles).toContain(".task-source-indicator");
  });

  it("uses the same source link in the macOS Task list", () => {
    const taskList = source("apps/macos/Sources/Views/TaskListView.swift");

    expect(taskList).toContain("if task.source == .shortcut");
    expect(taskList).toContain('Image(systemName: "link")');
    expect(taskList).toContain("Link(destination: sourceURL)");
    expect(taskList).toContain('return "Open SC-\\(reference) in Shortcut"');
    expect(taskList).toContain('Text(reference)');
  });

  it("uses a compact Shortcut mark with the Epic name in both task displays", () => {
    const app = source("apps/web/src/App.tsx");
    const taskList = source("apps/macos/Sources/Views/TaskListView.swift");
    const miniDashboard = source("apps/macos/Sources/Views/MiniDashboardComponents.swift");

    expect(app).toContain("task.sourceDetails?.epicName");
    expect(taskList).toContain("task.sourceDetails?.epicName");
    expect(miniDashboard).toContain("ShortcutMetadataLabel");
    expect(miniDashboard).toContain('Text(reference)');
  });
});
