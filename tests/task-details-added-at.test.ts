import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../", import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, repositoryRoot), "utf8");
}

describe("Task Details Added timestamp", () => {
  it("shows the task creation date and time on the web", () => {
    const taskDetail = source("apps/web/src/App.tsx");

    expect(taskDetail).toContain('dateStyle: "medium"');
    expect(taskDetail).toContain('timeStyle: "short"');
    expect(taskDetail).toContain('<time dateTime={task.createdAt}>{addedAtLabel}</time>');
  });

  it("shows the task creation date and time on macOS", () => {
    const taskDetail = source("apps/macos/Sources/Views/TaskDetailView.swift");

    expect(taskDetail).toContain('LabeledContent("Added")');
    expect(taskDetail).toContain(
      "task.createdAt.formatted(date: .abbreviated, time: .shortened)",
    );
  });
});
