import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const taskDetail = readFileSync(
  new URL("../apps/macos/Sources/Views/TaskDetailView.swift", import.meta.url),
  "utf8",
);

describe("macOS Task Details Notes editor", () => {
  it("adds internal scroll-content margins without moving the scrollbar", () => {
    expect(taskDetail).toContain(
      ".contentMargins(.horizontal, 12, for: .scrollContent)",
    );
    expect(taskDetail).toContain(
      ".contentMargins(.vertical, 10, for: .scrollContent)",
    );
  });
});
