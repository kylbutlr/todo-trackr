import webPush, { type PushSubscription as WebPushSubscription } from "web-push";
import { z } from "zod";

import { database } from "./database.js";
import { HttpError } from "./http.js";
import type { ShortcutPreviewItem } from "./automation/shortcut-rule.js";

const pushEndpointSchema = z.url().refine((value) => new URL(value).protocol === "https:", {
  message: "Push subscription endpoint must use HTTPS.",
});

export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const removePushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
});

type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

function vapidConfiguration(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function pushNotificationConfiguration(): { configured: boolean; publicKey: string | null } {
  const configuration = vapidConfiguration();
  return {
    configured: configuration !== null,
    publicKey: configuration?.publicKey ?? null,
  };
}

export async function savePushSubscription(
  subscription: z.infer<typeof pushSubscriptionSchema>,
  userAgent: string | null,
): Promise<void> {
  if (!vapidConfiguration()) {
    throw new HttpError(503, "Web Push is not configured yet.");
  }
  const sql = database();
  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent)
    VALUES (${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, ${userAgent})
    ON CONFLICT (endpoint) DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      updated_at = now()
  `;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const sql = database();
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

export function shortcutChangeNotification(items: ShortcutPreviewItem[]): PushPayload | null {
  const notifyItems = items.filter(({ action }) => action !== "update" && action !== "ignore");
  if (notifyItems.length === 0) return null;

  if (notifyItems.length === 1) {
    const [item] = notifyItems;
    const action = item.action === "create" ? "created" : item.action === "reopen" ? "reopened" : item.action === "complete" ? "completed" : "archived";
    return {
      title: `Shortcut ${action} a Task`,
      body: item.title,
      url: "/?view=source:shortcut",
      tag: `shortcut-${item.externalReference}-${item.action}`,
    };
  }

  const labels: Record<string, string> = {
    create: "created",
    reopen: "reopened",
    complete: "completed",
    archive: "archived",
  };
  const summary = Object.entries(labels)
    .map(([action, label]) => ({ label, count: notifyItems.filter((item) => item.action === action).length }))
    .filter(({ count }) => count > 0)
    .map(({ count, label }) => `${count} ${label}`)
    .join(" · ");
  return {
    title: `Shortcut changed ${notifyItems.length} Tasks`,
    body: summary,
    url: "/?view=source:shortcut",
    tag: "shortcut-reconciliation",
  };
}

async function sendPush(payload: PushPayload): Promise<void> {
  const configuration = vapidConfiguration();
  if (!configuration) return;

  webPush.setVapidDetails(configuration.subject, configuration.publicKey, configuration.privateKey);
  const sql = database();
  const subscriptions = (await sql`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
  `) as StoredSubscription[];

  await Promise.allSettled(subscriptions.map(async (stored) => {
    const subscription: WebPushSubscription = {
      endpoint: stored.endpoint,
      keys: { p256dh: stored.p256dh, auth: stored.auth },
    };
    try {
      await webPush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 });
      await sql`UPDATE push_subscriptions SET last_success_at = now() WHERE endpoint = ${stored.endpoint}`;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : undefined;
      if (statusCode === 404 || statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${stored.endpoint}`;
      } else {
        await sql`UPDATE push_subscriptions SET last_failure_at = now() WHERE endpoint = ${stored.endpoint}`;
      }
    }
  }));
}

export async function notifyTaskAlarm(task: { id: string; title: string }): Promise<void> {
  await sendPush({
    title: "Task needs attention",
    body: task.title,
    url: `/?view=all&task=${encodeURIComponent(task.id)}`,
    tag: `task-alarm-${task.id}`,
  });
}

export async function notifyShortcutChanges(items: ShortcutPreviewItem[]): Promise<void> {
  const payload = shortcutChangeNotification(items);
  if (payload) await sendPush(payload);
}

export async function notifyShortcutFailure(message: string): Promise<void> {
  await sendPush({
    title: "Shortcut sync needs attention",
    body: message,
    url: "/?view=connection:shortcut",
    tag: "shortcut-sync-failed",
  });
}

export async function notifyShortcutRecovery(): Promise<void> {
  await sendPush({
    title: "Shortcut sync recovered",
    body: "Todo Trackr is synchronized with Shortcut again.",
    url: "/?view=connection:shortcut",
    tag: "shortcut-sync-recovered",
  });
}
