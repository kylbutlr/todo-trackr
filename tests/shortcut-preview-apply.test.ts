import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../", import.meta.url);

describe("Shortcut preview reconciliation", () => {
  it("offers an explicit action for applying proposed changes", () => {
    const application = readFileSync(
      new URL("apps/web/src/App.tsx", repositoryRoot),
      "utf8",
    );
    const client = readFileSync(
      new URL("apps/web/src/api.ts", repositoryRoot),
      "utf8",
    );
    const server = readFileSync(
      new URL("netlify/functions/api.mts", repositoryRoot),
      "utf8",
    );

    expect(application).toContain("Apply changes");
    expect(client).toContain("/api/connections/shortcut/apply");
    expect(server).toContain('pathname === "/api/connections/shortcut/apply"');
  });
});
