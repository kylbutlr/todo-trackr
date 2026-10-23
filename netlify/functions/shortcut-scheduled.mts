import { automaticWorkAllowed } from "./lib/work-switch.js";
import type { Config } from "@netlify/functions";

import { requireEnvironment } from "./lib/config.js";

export default async (request: Request): Promise<void> => {
  if (process.env.TODO_TRACKER_SHORTCUT_REPAIR_ENABLED?.trim().toLowerCase() === "false") {
    return;
  }

  if (!await automaticWorkAllowed()) return;

  const response = await fetch(new URL("/.netlify/functions/shortcut-repair", request.url), {
    method: "POST",
    headers: {
      "x-todo-trackr-sync-secret": requireEnvironment("SHORTCUT_WEBHOOK_SECRET"),
    },
  });
  if (!response.ok) {
    throw new Error(`Unable to start Shortcut repair synchronization: HTTP ${response.status}.`);
  }
};

export const config: Config = {
  schedule: "17 */6 * * *",
};
