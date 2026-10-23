import { afterEach, describe, expect, it, vi } from "vitest";
import { automaticWorkAllowed, workPermission } from "../netlify/functions/lib/work-switch.js";
import { createHmac } from "node:crypto";
import { processShortcutWebhook } from "../netlify/functions/lib/automation/shortcut-webhook.js";
import shortcutScheduled from "../netlify/functions/shortcut-scheduled.mjs";
import granolaScheduled from "../netlify/functions/granola-scheduled.mjs";
import { installationCapabilities } from "../netlify/functions/lib/installation.js";
import { clientWorkPermission, resumeAutomaticWork } from "../netlify/functions/lib/work-resume.js";
import { deferWorkEvent } from "../netlify/functions/lib/work-inbox.js";
import { automaticWorkAllowed as clientWorkAllowed } from "../apps/web/src/workSwitch.js";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function configure() { vi.stubEnv("APP_SWITCHR_URL", "https://switch.test/api/work-state"); vi.stubEnv("APP_SWITCHR_READER_TOKEN", "reader-test-token"); }
describe("shared work permission", () => {
  it("standalone work ignores inherited Switchr settings without network or hosted storage", async () => {
    vi.stubEnv("TODO_TRACKER_RUNTIME", "standalone");
    configure();
    const fetcher = vi.fn().mockRejectedValue(new Error("Switchr must not be contacted"));
    vi.stubGlobal("fetch", fetcher);
    expect(installationCapabilities().workSwitch).toBe(false);
    expect(await automaticWorkAllowed()).toBe(true);
    expect(await clientWorkPermission()).toMatchObject({ configured: false, state: "active", catchUpPending: false });
    expect(await deferWorkEvent("shortcut", "test-event", "{}")).toBe(false);
    await resumeAutomaticWork();
    expect(clientWorkAllowed(false)).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("is backward compatible when explicitly unconfigured", async () => {
    vi.stubEnv("APP_SWITCHR_URL", ""); vi.stubEnv("APP_SWITCHR_READER_TOKEN", "");
    expect(await workPermission()).toMatchObject({ configured: false, state: "active" });
  });
  it("fails closed for incomplete config, HTTP failure, invalid lease and network outage", async () => {
    configure(); vi.stubEnv("APP_SWITCHR_READER_TOKEN", ""); expect(await automaticWorkAllowed()).toBe(false);
    configure(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null,{status:503})));
    expect(await automaticWorkAllowed()).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({state:"active",revision:1,leaseSeconds:999})));
    expect(await automaticWorkAllowed()).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline"))); expect(await automaticWorkAllowed()).toBe(false);
  });
  it("stops both scheduled handoffs before secrets, provider calls or database work", async () => {
    configure(); vi.stubEnv("SHORTCUT_WEBHOOK_SECRET", ""); vi.stubEnv("GRANOLA_WEBHOOK_SECRET", "");
    const fetcher = vi.fn().mockImplementation(async()=>Response.json({state:"standby",revision:2,leaseSeconds:0}));
    vi.stubGlobal("fetch",fetcher);
    await shortcutScheduled(new Request("https://todo.test/scheduled"));
    await granolaScheduled(new Request("https://todo.test/scheduled"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([url])=>String(url)==="https://switch.test/api/work-state")).toBe(true);
  });
  it("persists validated webhooks before database claims, and never acknowledges failed persistence", async () => {
    const body = JSON.stringify({id:"event-123",actions:[{id:12,entity_type:"story",action:"update"}]});
    const secret = "test-secret", signature = createHmac("sha256",secret).update(body).digest("hex");
    const claim = vi.fn(), sync = vi.fn(), defer = vi.fn().mockResolvedValue(true);
    await processShortcutWebhook(body,signature,secret,{claim,sync,defer});
    expect(defer).toHaveBeenCalledOnce(); expect(claim).not.toHaveBeenCalled(); expect(sync).not.toHaveBeenCalled();
    defer.mockRejectedValue(new Error("storage offline"));
    await expect(processShortcutWebhook(body,signature,secret,{claim,sync,defer})).rejects.toThrow("storage offline");
    expect(claim).not.toHaveBeenCalled();
    defer.mockClear();
    await expect(processShortcutWebhook(body,"invalid",secret,{claim,sync,defer})).rejects.toThrow("signature");
    expect(defer).not.toHaveBeenCalled();
  });
});
