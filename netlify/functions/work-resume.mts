import type { Config } from "@netlify/functions";
import { requireSession } from "./lib/auth.js";
import { resumeAutomaticWork } from "./lib/work-resume.js";
export default async (request: Request): Promise<void> => {
  await requireSession(request);
  await resumeAutomaticWork();
};
export const config: Config = { background: true, method: "POST", path: "/api/work-resume" };
