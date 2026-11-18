import { useEffect, useRef } from 'react';
import { createAdaptiveRefresh } from './adaptiveRefresh.js';
import { automaticWorkAllowed } from './workSwitch.js';
import { shouldPollWorkspace } from './workspaceRefreshPolicy.js';

export function useAdaptiveRefresh(load: () => Promise<unknown>) {
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    const allowed = () => automaticWorkAllowed() && navigator.onLine && shouldPollWorkspace(document.visibilityState);
    const refresh = createAdaptiveRefresh(() => loader.current(), allowed);
    // The initial read preserves the existing explicit screen-open behavior.
    void refresh.refresh(true);
    const resume = () => { if (allowed()) void refresh.refresh(true); };
    window.addEventListener('app-switchr-resumed', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      refresh.stop();
      window.removeEventListener('app-switchr-resumed', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);
}
