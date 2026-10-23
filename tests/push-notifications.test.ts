import { describe, expect, it } from "vitest";

import { shortcutChangeNotification } from "../netlify/functions/lib/push-notifications.js";
import type { ShortcutPreviewItem } from "../netlify/functions/lib/automation/shortcut-rule.js";

function item(action: ShortcutPreviewItem["action"], title: string): ShortcutPreviewItem {
  return {
    externalReference: title.length.toString(),
    sourceUrl: "https://app.shortcut.com/sdg/story/1",
    title,
    description: "",
    contentFingerprint: "content",
    sourceFingerprint: "source",
    priority: "none",
    size: null,
    dueDate: null,
    ownerIds: [],
    epicId: null,
    epicName: null,
    workflowStateId: 1,
    workflowStateName: "Triage",
    archived: false,
    sourceUpdatedAt: "2026-08-16T12:00:00Z",
    taskId: null,
    currentLifecycle: "open",
    action,
    reason: "Rule decision.",
    needsSummary: false,
    sourceSummary: null,
  };
}

describe("automation push notifications", () => {
  it("names a single lifecycle change", () => {
    expect(shortcutChangeNotification([item("create", "Review navigation")])).toMatchObject({
      title: "Shortcut created a Task",
      body: "Review navigation",
    });
  });

  it("groups lifecycle changes and omits metadata-only updates", () => {
    expect(shortcutChangeNotification([
      item("create", "One"),
      item("complete", "Two"),
      item("update", "Three"),
    ])).toMatchObject({
      title: "Shortcut changed 2 Tasks",
      body: "1 created · 1 completed",
    });
  });

  it("does not notify for metadata-only updates", () => {
    expect(shortcutChangeNotification([item("update", "Priority changed")])).toBeNull();
  });
});
