import { afterEach, expect, it, vi } from "vitest";

const settingsStore = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("../netlify/functions/lib/automation/shortcut-settings.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../netlify/functions/lib/automation/shortcut-settings.js")>(),
  loadShortcutWorkflowSettings: settingsStore.load,
  updateShortcutWorkflowSettings: settingsStore.save,
}));
import api from "../netlify/functions/api.mjs";
import { createSessionToken } from "../netlify/functions/lib/auth.js";
import { HttpError } from "../netlify/functions/lib/http.js";

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

async function headers() {
  vi.stubEnv("SESSION_SIGNING_SECRET", "test-only-signing-secret-with-enough-characters");
  return { authorization: `Bearer ${await createSessionToken()}`, "content-type": "application/json" };
}

it("requires authentication before reading or saving workflow selections", async () => {
  const path = "https://todo.test/api/connections/shortcut/workflow-settings";
  for (const method of ["GET", "PATCH"]) {
    expect((await api(new Request(path, { method }))).status).toBe(401);
  }
  expect(settingsStore.load).not.toHaveBeenCalled();
  expect(settingsStore.save).not.toHaveBeenCalled();
});

it("returns the shared selection to an authenticated client", async () => {
  settingsStore.load.mockResolvedValue({ version: 3, activeStates: { 500134189: "Engineering Triage" } });
  const response = await api(new Request("https://todo.test/api/connections/shortcut/workflow-settings", { headers: await headers() }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ settings: { activeStates: { 500134189: "Engineering Triage" } } });
});

it("validates saves and returns stale-version conflicts without claiming success", async () => {
  const requestHeaders = await headers();
  const path = "https://todo.test/api/connections/shortcut/workflow-settings";
  const invalid = await api(new Request(path, { method: "PATCH", headers: requestHeaders, body: JSON.stringify({ expectedVersion: 0, activeStateIds: [] }) }));
  expect(invalid.status).toBe(400);
  expect(settingsStore.save).not.toHaveBeenCalled();
  settingsStore.save.mockRejectedValue(new HttpError(409, "Reload settings before saving."));
  const conflict = await api(new Request(path, { method: "PATCH", headers: requestHeaders, body: JSON.stringify({ expectedVersion: 1, activeStateIds: [500134189] }) }));
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toEqual({ error: "Reload settings before saving." });
  expect(settingsStore.save).toHaveBeenCalledWith({ expectedVersion: 1, activeStateIds: [500134189] });
});
