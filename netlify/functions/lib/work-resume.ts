import { getStore } from "@netlify/blobs";
import { workInbox } from "./work-inbox.js";
import { workPermission, type WorkPermission } from "./work-switch.js";
import { drainWorkInbox } from "./work-inbox-drain.js";
import { runAutomaticShortcutSync } from "./automation/shortcut-sync.js";

export function resumeStore() { return getStore({ name: "todo-work-resume-v1", consistency: "strong" }); }
type ResumeRecord = { completedRevision: number; leaseUntil: number };
export async function clientWorkPermission(): Promise<WorkPermission & { catchUpPending: boolean }> {
  const permission = await workPermission();
  if (!permission.configured || permission.state !== "active") return { ...permission, catchUpPending: false };
  try {
    const record = await resumeStore().get("resume", { type: "json" }) as ResumeRecord | null;
    let pending = record?.completedRevision !== permission.revision;
    if (!pending) {
      for await (const page of workInbox().list({ paginate: true })) {
        if (page.blobs.length) { pending = true; break; }
      }
    }
    return { ...permission, catchUpPending: pending };
  } catch { return { configured: true, state: "unavailable", revision: permission.revision, leaseSeconds: 0, catchUpPending: false }; }
}
export async function resumeAutomaticWork(): Promise<void> {
  const permission = await workPermission();
  if (!permission.configured || permission.state !== "active" || permission.leaseSeconds <= 0) return;
  const store = resumeStore();
  const previous = await store.getWithMetadata("resume", { type: "json" });
  const data = previous?.data as ResumeRecord | undefined;
  if (data && data.leaseUntil > Date.now()) return;
  // Longer than the platform's background-function lifetime. A crashed worker is retryable.
  const claimed = await store.setJSON("resume", { completedRevision: data?.completedRevision ?? -1, leaseUntil: Date.now() + 16 * 60_000 }, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
  if (!claimed.modified) return;
  let completedRevision = data?.completedRevision ?? -1;
  try {
    const drained = await drainWorkInbox();
    const fresh = await workPermission();
    if (fresh.state !== "active" || fresh.revision !== permission.revision || fresh.leaseSeconds <= 0) return;
    if (completedRevision !== fresh.revision && drained) {
      await runAutomaticShortcutSync({ trigger: "scheduled" });
      // A bounded batch leaves catch-up pending until a later client check or repair.
      if (drained) completedRevision = fresh.revision;
    }
  } finally {
    await store.setJSON("resume", { completedRevision, leaseUntil: 0 }, { onlyIfMatch: claimed.etag });
  }
}
