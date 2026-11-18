import { resumeAutomaticWork } from "./lib/work-resume.js";
import { automaticWorkAllowed } from "./lib/work-switch.js";
import type { Config } from "@netlify/functions";

import {
  runAutomaticShortcutSync,
  verifyInternalShortcutSyncSecret,
} from "./lib/automation/shortcut-sync.js";
import { requireEnvironment } from "./lib/config.js";

export default async (request: Request): Promise<void> => {
  const suppliedSecret = request.headers.get("x-todo-trackr-sync-secret") ?? "";
  const expectedSecret = requireEnvironment("SHORTCUT_WEBHOOK_SECRET");
  if (!verifyInternalShortcutSyncSecret(suppliedSecret, expectedSecret)) {
    throw new Error("Unauthorized Shortcut repair synchronization.");
  }

  if (!await automaticWorkAllowed()) return;
  await resumeAutomaticWork();
  if (!await automaticWorkAllowed()) return;

  await runAutomaticShortcutSync({ trigger: "scheduled" });
};

export const config: Config = {
  background: true,
  method: "POST",
};
