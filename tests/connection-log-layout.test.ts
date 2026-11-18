import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../apps/web/src/styles.css", import.meta.url), "utf8");

describe("connection log layout", () => {
  it("allows rule shadow titles and history content to shrink inside their panels", () => {
    expect(styles).toMatch(/\.rule-shadow-item strong\s*\{[^}]*min-width:\s*0/u);
    expect(styles).toMatch(/\.history-row\s*\{[^}]*min-width:\s*0/u);
    expect(styles).toMatch(/\.history-row\s*\{[^}]*overflow:\s*hidden/u);
  });
});
