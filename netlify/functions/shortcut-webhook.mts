import type { Config } from "@netlify/functions";
import { z } from "zod";
import { processShortcutWebhook } from "./lib/automation/shortcut-webhook.js";
import { requireEnvironment } from "./lib/config.js";
import { HttpError, json, noContent } from "./lib/http.js";

// Synchronous receipt ensures standby events are durable before acknowledging delivery.
export default async (request: Request): Promise<Response> => {
  try {
    await processShortcutWebhook(await request.text(), request.headers.get("payload-signature") ?? "", requireEnvironment("SHORTCUT_WEBHOOK_SECRET"));
    return noContent();
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return json({ error: "Invalid Shortcut event." }, { status: 400 });
    return json({ error: "Could not preserve or process Shortcut event." }, { status: 503 });
  }
};
export const config: Config = { method: "POST", path: "/api/webhooks/shortcut" };
