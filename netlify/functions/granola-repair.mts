import { resumeAutomaticWork } from "./lib/work-resume.js";
import { automaticWorkAllowed } from "./lib/work-switch.js";
import type { Config } from "@netlify/functions";

import { backfillRecentGranolaNotes } from "./lib/automation/granola-backfill.js";
import { verifyInternalSyncSecret } from "./lib/automation/internal-sync.js";
import { granolaScheduledUpdatedAfter } from "./lib/automation/granola-repository.js";
import { requireEnvironment } from "./lib/config.js";

export default async (request: Request): Promise<void> => {
  const suppliedSecret = request.headers.get("x-todo-trackr-sync-secret") ?? "";
  const expectedSecret = requireEnvironment("GRANOLA_WEBHOOK_SECRET");
  if (!verifyInternalSyncSecret(suppliedSecret, expectedSecret)) {
    throw new Error("Unauthorized Granola review reconciliation.");
  }

  if (!await automaticWorkAllowed()) return;
  await resumeAutomaticWork();
  if (!await automaticWorkAllowed()) return;

  await backfillRecentGranolaNotes(
    requireEnvironment("GRANOLA_API_KEY"),
    {
      updatedAfter: await granolaScheduledUpdatedAfter(),
      trigger: "scheduled",
    },
  );
};

export const config: Config = {
  background: true,
  method: "POST",
};
