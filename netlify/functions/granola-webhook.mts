import type { Config } from "@netlify/functions";
import { z } from "zod";

import { processGranolaWebhook } from "./lib/automation/granola-webhook.js";
import { requireEnvironment } from "./lib/config.js";
import { HttpError, json, noContent } from "./lib/http.js";

export default async (request: Request): Promise<Response> => {
  try {
    const body = await request.text();
    await processGranolaWebhook(
      body,
      {
        id: request.headers.get("webhook-id") ?? "",
        timestamp: request.headers.get("webhook-timestamp") ?? "",
        signature: request.headers.get("webhook-signature") ?? "",
      },
      {
        webhook: requireEnvironment("GRANOLA_WEBHOOK_SECRET"),
        apiKey: requireEnvironment("GRANOLA_API_KEY"),
      },
    );
    return noContent();
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return json({ error: "Invalid Granola webhook event." }, { status: 400 });
    console.error("Granola webhook error", error);
    return json({ error: "Unexpected Granola webhook error." }, { status: 500 });
  }
};

export const config: Config = {
  method: "POST",
  path: "/api/webhooks/granola",
};
