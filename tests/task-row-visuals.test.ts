import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../", import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, repositoryRoot), "utf8");
}

describe("Task row metadata", () => {
  it("keeps priority visible in web Task rows when it is unset", () => {
    const app = source("apps/web/src/App.tsx");

    expect(app).toContain('task.priority === "none" ? "No priority" : task.priority');
  });

  it("keeps priority visible in native Task rows when it is unset", () => {
    const taskList = source("apps/macos/Sources/Views/TaskListView.swift");

    expect(taskList).toContain("Text(task.priority.label)");
    expect(taskList).not.toContain("if task.priority != .none");
  });
});
