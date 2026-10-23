import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const application = readFileSync(
  new URL("../apps/web/src/App.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../apps/web/src/styles.css", import.meta.url),
  "utf8",
);

describe("sync status position", () => {
  it("renders one shared floating status for desktop and mobile", () => {
    expect(application.match(/floating-sync-status/g)).toHaveLength(1);
    expect(application).toContain('title="Tasks refresh on focus and slow to every 10 minutes when unchanged"');
  });

  it("keeps the status fixed in the bottom-left viewport corner", () => {
    expect(styles).toMatch(
      /\.floating-sync-status\s*\{[\s\S]*?position: fixed;[\s\S]*?left: calc\(18px \+ env\(safe-area-inset-left\)\);[\s\S]*?bottom: calc\(18px \+ env\(safe-area-inset-bottom\)\);/u,
    );
  });
});
