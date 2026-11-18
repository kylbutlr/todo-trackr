import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("automation observability", () => {
  it("exposes connection diagnostics and per-Task activity", () => {
    const api = readFileSync(new URL("netlify/functions/api.mts", root), "utf8");
    const repository = readFileSync(new URL("netlify/functions/lib/automation/shortcut-repository.ts", root), "utf8");
    const application = readFileSync(new URL("apps/web/src/App.tsx", root), "utf8");

    expect(api).toContain('"/api/connections/shortcut/diagnostics"');
    expect(api).toContain("loadTaskAutomationActivity(activityTaskId)");
    expect(repository).toContain("started_at >= now() - interval '90 days'");
    expect(application).toContain("Sync history");
    expect(application).toContain("Connection activity");
    expect(application).toContain("Automation activity");
  });
});
