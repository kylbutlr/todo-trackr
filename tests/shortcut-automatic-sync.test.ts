import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  processShortcutWebhook,
  shortcutStoryReferences,
  verifyShortcutWebhookSignature,
} from "../netlify/functions/lib/automation/shortcut-webhook.js";
import {
  runAutomaticShortcutSync,
  verifyInternalShortcutSyncSecret,
} from "../netlify/functions/lib/automation/shortcut-sync.js";
import type { ShortcutPreviewItem } from "../netlify/functions/lib/automation/shortcut-rule.js";

const repositoryRoot = new URL("../", import.meta.url);

describe("automatic Shortcut synchronization", () => {
  it("authenticates webhook bodies with Shortcut's HMAC-SHA-256 signature", () => {
    const body = JSON.stringify({ id: "event-one", actions: [] });
    const secret = "test-webhook-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    expect(verifyShortcutWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyShortcutWebhookSignature(`${body} `, signature, secret)).toBe(false);
  });

  it("authenticates scheduled repair handoffs", () => {
    expect(verifyInternalShortcutSyncSecret("repair-secret", "repair-secret")).toBe(true);
    expect(verifyInternalShortcutSyncSecret("wrong-secret", "repair-secret")).toBe(false);
  });

  it("extracts only changed Story references from a workspace webhook", () => {
    expect(shortcutStoryReferences({
      actions: [
        { id: 489619, entity_type: "story", action: "update" },
        { id: 200, entity_type: "epic", action: "update" },
        { id: 489620, entity_type: "story", action: "create" },
      ],
    })).toEqual(["489619", "489620"]);
  });

  it("deduplicates webhook events before applying reconciliation", async () => {
    const body = JSON.stringify({
      id: "event-one",
      actions: [{ id: 489619, entity_type: "story", action: "update" }],
    });
    const secret = "test-webhook-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    const sync = vi.fn(async () => ({ outcome: "applied" as const, applied: 1 }));
    const finish = vi.fn(async () => undefined);

    await processShortcutWebhook(body, signature, secret, {
      claim: vi.fn(async () => true),
      finish,
      sync,
    });
    expect(sync).toHaveBeenCalledWith({ trigger: "webhook", references: ["489619"] });
    expect(finish).toHaveBeenCalledWith("event-one", "succeeded");

    sync.mockClear();
    await processShortcutWebhook(body, signature, secret, {
      claim: vi.fn(async () => false),
      finish,
      sync,
    });
    expect(sync).not.toHaveBeenCalled();
  });

  it("applies webhook changes only in Automatic mode", async () => {
    const changedItem: ShortcutPreviewItem = {
      externalReference: "489619",
      sourceUrl: "https://app.shortcut.com/sdg/story/489619",
      title: "Setup TRAIN Concierge Environment",
      description: "Updated request.",
      contentFingerprint: "content",
      sourceFingerprint: "source",
      priority: "highest",
      size: "M",
      dueDate: "2026-08-17",
      ownerIds: [],
      epicId: null,
      epicName: null,
      workflowStateId: 500127059,
      workflowStateName: "Pending Eng",
      archived: false,
      sourceUpdatedAt: "2026-08-16T12:00:00Z",
      taskId: "00000000-0000-4000-8000-000000000619",
      currentLifecycle: "open",
      action: "update",
      reason: "Shortcut-owned fields changed.",
      needsSummary: false,
      sourceSummary: "Updated request.",
    };
    const preview = vi.fn(async () => ({ items: [changedItem] }));
    const apply = vi.fn(async () => undefined);
    const notifyChanges = vi.fn(async () => undefined);

    await expect(runAutomaticShortcutSync({ trigger: "webhook", references: ["489619"] }, {
      loadConnection: async () => ({ paused: false, syncMode: "review" }),
      preview,
      apply,
      recordFailure: vi.fn(async () => undefined),
      notifyChanges,
    })).resolves.toMatchObject({ outcome: "ignored" });
    expect(preview).not.toHaveBeenCalled();

    await expect(runAutomaticShortcutSync({ trigger: "webhook", references: ["489619"] }, {
      loadConnection: async () => ({ paused: false, syncMode: "automatic" }),
      preview,
      apply,
      recordFailure: vi.fn(async () => undefined),
      notifyChanges,
    })).resolves.toMatchObject({ outcome: "applied", applied: 1 });
    expect(apply).toHaveBeenCalledOnce();
    expect(notifyChanges).toHaveBeenCalledWith([changedItem]);
  });

  it("notifies once when a synchronization failure reaches its alert threshold", async () => {
    const notifyFailure = vi.fn(async () => undefined);
    const failure = new Error("Shortcut could not be reached.");

    await expect(runAutomaticShortcutSync({ trigger: "scheduled" }, {
      loadConnection: async () => ({ paused: false, syncMode: "automatic" }),
      preview: vi.fn(async () => { throw failure; }),
      recordFailure: vi.fn(async () => ({
        health: "failed" as const,
        consecutiveFailures: 3,
        shouldNotify: true,
        message: failure.message,
      })),
      notifyFailure,
    })).rejects.toThrow(failure.message);

    expect(notifyFailure).toHaveBeenCalledWith(failure.message);
  });

  it("ships authenticated webhooks plus a six-hour full repair schedule", () => {
    const migration = readFileSync(new URL("database/migrations/0005_connection_sync_modes.sql", repositoryRoot), "utf8");
    const application = readFileSync(new URL("apps/web/src/App.tsx", repositoryRoot), "utf8");
    const webhook = readFileSync(new URL("netlify/functions/shortcut-webhook.mts", repositoryRoot), "utf8");
    const fullScheduled = readFileSync(new URL("netlify/functions/shortcut-scheduled.mts", repositoryRoot), "utf8");
    const repair = readFileSync(new URL("netlify/functions/shortcut-repair.mts", repositoryRoot), "utf8");

    expect(migration).toContain("sync_mode");
    expect(migration).toContain("source_webhook_events");
    expect(application).toContain("Off");
    expect(application).toContain("Review");
    expect(application).toContain("Automatic");
    expect(application).toContain('controlMode === "review" ? (\n            <button className="secondary-button"');
    expect(application).toContain('controlMode === "automatic" ? (\n            <button className="secondary-button"');
    expect(application).toContain("six-hour reconciliation safety net");
    expect(application).toContain("repairs missed changes every six hours");
    expect(webhook).toContain('path: "/api/webhooks/shortcut"');
    expect(webhook).toContain("SHORTCUT_WEBHOOK_SECRET");
    expect(fullScheduled).toContain('schedule: "17 */6 * * *"');
    expect(fullScheduled).toContain("/.netlify/functions/shortcut-repair");
    expect(repair).toContain("background: true");
  });
});
