import { deferWorkEvent } from "../work-inbox.js";
import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { HttpError } from "../http.js";
import {
  claimShortcutWebhookEvent,
  finishShortcutWebhookEvent,
} from "./shortcut-repository.js";
import { runAutomaticShortcutSync } from "./shortcut-sync.js";

const shortcutWebhookActionSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]),
  entity_type: z.string().min(1),
  action: z.string().min(1),
}).passthrough();

export const shortcutWebhookEventSchema = z.object({
  id: z.string().min(1).max(200),
  actions: z.array(shortcutWebhookActionSchema).default([]),
}).passthrough();

export type ShortcutWebhookEvent = z.infer<typeof shortcutWebhookEventSchema>;

export function verifyShortcutWebhookSignature(
  body: string,
  suppliedSignature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const suppliedBytes = Buffer.from(suppliedSignature.trim().toLowerCase(), "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return suppliedBytes.length === expectedBytes.length
    && timingSafeEqual(suppliedBytes, expectedBytes);
}

export function shortcutStoryReferences(event: Pick<ShortcutWebhookEvent, "actions">): string[] {
  return [...new Set(event.actions
    .filter(({ entity_type }) => entity_type === "story")
    .map(({ id }) => String(id)))];
}

type WebhookDependencies = {
  claim: typeof claimShortcutWebhookEvent;
  finish: typeof finishShortcutWebhookEvent;
  sync: typeof runAutomaticShortcutSync;
  defer: typeof deferWorkEvent;
};

const defaultDependencies: WebhookDependencies = {
  claim: claimShortcutWebhookEvent,
  finish: finishShortcutWebhookEvent,
  sync: runAutomaticShortcutSync,
  defer: deferWorkEvent,
};

export async function processShortcutWebhook(
  body: string,
  suppliedSignature: string,
  secret: string,
  dependencies: Partial<WebhookDependencies> = {},
): Promise<boolean> {
  if (!verifyShortcutWebhookSignature(body, suppliedSignature, secret)) {
    throw new HttpError(401, "Invalid Shortcut webhook signature.");
  }

  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    throw new HttpError(400, "Shortcut webhook body must be valid JSON.");
  }
  const event = shortcutWebhookEventSchema.parse(input);
  return processVerifiedShortcutWebhook(event, dependencies);
}

// Internal replay entry point. Public callers must verify the signature first.
export async function processVerifiedShortcutWebhook(event: ShortcutWebhookEvent, dependencies: Partial<WebhookDependencies> = {}): Promise<boolean> {
  const references = shortcutStoryReferences(event);
  const deps = { ...defaultDependencies, ...dependencies };
  if (await deps.defer("shortcut", event.id, JSON.stringify(event))) return false;
  if (!await deps.claim(event.id, references)) return false;

  if (references.length === 0) {
    await deps.finish(event.id, "ignored");
    return true;
  }

  try {
    const result = await deps.sync({ trigger: "webhook", references });
    await deps.finish(event.id, result.outcome === "ignored" ? "ignored" : "succeeded");
    return true;
  } catch (error) {
    await deps.finish(
      event.id,
      "failed",
      error instanceof Error ? error.message : "Unexpected Shortcut webhook failure.",
    );
    throw error;
  }
}
