import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { automaticWorkAllowed } from "./work-switch.js";
import { workSwitchEnabled } from "./installation.js";

export type DeferredEvent = { provider: "shortcut" | "granola" | "granola-actions" | "codex"; body: string; receivedAt: string };
export function workInbox() { return getStore({ name: "todo-work-inbox-v1", consistency: "strong" }); }
// Called only after signature and schema validation. No source credentials are stored.
export async function deferWorkEvent(provider: DeferredEvent["provider"], id: string, body: string): Promise<boolean> {
  const configured = workSwitchEnabled();
  // All configured receipts use the same durable path, including while active.
  // This prevents live updates from overtaking deferred patches during catch-up.
  if (!configured && await automaticWorkAllowed()) return false;
  const key = `${provider}/${provider === "codex" ? `${new Date().toISOString()}/` : ""}${createHash("sha256").update(id).digest("hex")}`;
  await workInbox().setJSON(key, { provider, body, receivedAt: new Date().toISOString() } satisfies DeferredEvent, { onlyIfNew: true });
  return true;
}
