import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../", import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, repositoryRoot), "utf8");
}

describe("macOS menu-bar Quick Capture", () => {
  it("runs as a menu-bar utility with a full workspace on demand", () => {
    expect(source("apps/macos/Resources/Info.plist")).toMatch(
      /<key>LSUIElement<\/key>\s*<true\/>/u,
    );
    expect(source("apps/macos/Sources/TodoTrackerApp.swift")).toContain("MenuBarController");
    expect(source("apps/macos/Sources/TodoTrackerApp.swift")).toContain('id: "workspace"');
  });

  it("registers Command-Shift-E and captures selected accessible text", () => {
    const controller = source("apps/macos/Sources/Services/GlobalQuickCaptureController.swift");
    expect(controller).toContain("kVK_ANSI_E");
    expect(controller).toContain("cmdKey | shiftKey");
    expect(source("apps/macos/Sources/Services/SelectedTextReader.swift")).toContain(
      "kAXSelectedTextAttribute",
    );
    expect(source("apps/macos/Sources/Services/SelectedTextReader.swift")).not.toContain(
      "AXIsProcessTrustedWithOptions",
    );
  });

  it("dismisses Quick Capture before waiting for Task creation", () => {
    const quickCapture = source("apps/macos/Sources/Views/QuickCaptureView.swift");
    const submit = quickCapture.slice(quickCapture.indexOf("private func submit()"));

    expect(submit.indexOf("dismissCapture()")).toBeGreaterThan(-1);
    expect(submit.indexOf("dismissCapture()")).toBeLessThan(submit.indexOf("Task {"));
  });

  it("preserves Slack as the native Quick Capture source", () => {
    const selectedTextReader = source(
      "apps/macos/Sources/Services/SelectedTextReader.swift",
    );
    const controller = source(
      "apps/macos/Sources/Services/GlobalQuickCaptureController.swift",
    );
    const taskInput = source("apps/macos/Sources/Models/TaskItem.swift");
    const quickCapture = source("apps/macos/Sources/Views/QuickCaptureView.swift");

    expect(selectedTextReader).toContain("bundleIdentifier");
    expect(controller).toContain('com.tinyspeck.slackmacgap');
    expect(taskInput).toContain("let source: TaskSource");
    expect(quickCapture).toContain("source: request?.source ?? .manual");
  });

  it("shows a non-link source label for native Slack captures", () => {
    const taskDetail = source("apps/macos/Sources/Views/TaskDetailView.swift");
    const webDetails = source("apps/web/src/App.tsx");

    expect(taskDetail).toContain('Label("Captured from \\(task.source.label)"');
    expect(webDetails).toContain("<p>Captured from {sourceLabel}</p>");
  });
});
