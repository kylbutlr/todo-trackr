import { automaticWorkAllowed } from "./lib/work-switch.js";
import type { Config } from "@netlify/functions";

import { requireEnvironment } from "./lib/config.js";

export default async (request: Request): Promise<void> => {
  if (process.env.TODO_TRACKER_GRANOLA_REPAIR_ENABLED?.trim().toLowerCase() === "false") {
    return;
  }

  if (!await automaticWorkAllowed()) return;

  const response = await fetch(new URL("/.netlify/functions/granola-repair", request.url), {
    method: "POST",
    headers: {
      "x-todo-trackr-sync-secret": requireEnvironment("GRANOLA_WEBHOOK_SECRET"),
    },
  });
  if (!response.ok) {
    throw new Error(`Unable to start Granola review reconciliation: HTTP ${response.status}.`);
  }
};

export const config: Config = {
  schedule: "17 */6 * * *",
};
