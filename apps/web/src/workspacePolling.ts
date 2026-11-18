import { shouldPollWorkspace, WORKSPACE_POLL_INTERVAL_MS } from "./workspaceRefreshPolicy.js";

// Own only automatic reads. Initial loads and user actions keep their explicit paths.
export function startWorkspacePolling(
  refresh: (resumed: boolean) => void,
  isDue: () => boolean,
  automaticWorkAllowed: () => boolean,
): () => void {
  const allowed = () => navigator.onLine
    && shouldPollWorkspace(document.visibilityState)
    && automaticWorkAllowed();
  const resume = () => { if (allowed()) refresh(true); };
  const tick = () => { if (allowed() && isDue()) refresh(false); };
  const timer = window.setInterval(tick, WORKSPACE_POLL_INTERVAL_MS);
  window.addEventListener("app-switchr-resumed", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  document.addEventListener("visibilitychange", resume);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("app-switchr-resumed", resume);
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}
