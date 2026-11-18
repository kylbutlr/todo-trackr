// Engineering workflow order verified in Shortcut on 2026-09-27.
const workflowStates = [
  "Backlog",
  "Triage",
  "Triage In Progress",
  "Ready for Pickup",
  "Ready for LOE",
  "Ready for Development",
  "Engineering Triage",
  "In Progress",
  "Pending Ops",
  "Pending Eng",
  "Pending Client",
  "Agentic QA",
  "QA In Progress",
  "Engineering Review",
  "CSM Review",
  "QA in Staging",
  "Production Approved",
  "Deployed",
  "Completed",
] as const;

const workflowRank = new Map<string, number>(workflowStates.map((state, index) => [state, index]));

export function compareShortcutWorkflowStatesDescending(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return (workflowRank.get(right ?? "") ?? -1) - (workflowRank.get(left ?? "") ?? -1);
}
