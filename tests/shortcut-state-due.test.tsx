import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ShortcutStateDueLabel,
  shortcutDueDateLabel,
  shortcutWorkflowStateLabel,
} from "../apps/web/src/ShortcutStateDueLabel.js";

describe("Shortcut state and due date display", () => {
  it("keeps both values and their separator together", () => {
    const markup = renderToStaticMarkup(
      <ShortcutStateDueLabel workflowStateName="Production Approved" dueDateLabel="Sep 29" />,
    );

    expect(markup).toContain("Production Approved</span>");
    expect(markup).toContain('aria-hidden="true" class="shortcut-state-due-separator">|</span>');
    expect(markup).toContain("Sep 29</span>");
    expect(markup).toContain("Shortcut workflow state Production Approved; due date Sep 29");
  });

  it("uses N/A for absent workflow states and due dates", () => {
    expect(shortcutWorkflowStateLabel("  ")).toBe("N/A");
    expect(shortcutDueDateLabel(null)).toBe("N/A");

    const markup = renderToStaticMarkup(
      <ShortcutStateDueLabel workflowStateName={null} dueDateLabel="N/A" />,
    );
    expect(markup).toContain("N/A</span>");
    expect(markup).toContain("Shortcut workflow state N/A; due date not set");
  });
});
