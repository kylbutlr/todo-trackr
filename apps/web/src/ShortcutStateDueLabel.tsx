export function shortcutWorkflowStateLabel(value: string | null | undefined): string {
  return value?.trim() || "N/A";
}

export function shortcutDueDateLabel(value: Date | null): string {
  return value
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(value)
    : "N/A";
}

export function ShortcutStateDueLabel({ workflowStateName, dueDateLabel, dueTone }: {
  workflowStateName: string | null | undefined;
  dueDateLabel: string;
  dueTone?: "overdue" | "today";
}) {
  const state = shortcutWorkflowStateLabel(workflowStateName);
  const date = dueDateLabel || "N/A";

  return (
    <span
      aria-label={`Shortcut workflow state ${state}; due date ${date === "N/A" ? "not set" : date}`}
      className="shortcut-state-due"
      title={`Shortcut workflow state: ${state}; due date: ${date}`}
    >
      <span className="shortcut-state-due-state">{state}</span>
      <span aria-hidden="true" className="shortcut-state-due-separator">|</span>
      <span className={`shortcut-state-due-date ${dueTone ? `is-${dueTone}` : ""}`}>{date}</span>
    </span>
  );
}
