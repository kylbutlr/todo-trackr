import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../apps/web/src/styles.css", import.meta.url), "utf8");

describe("Task toolbar styles", () => {
  it("shrinks search before filter controls overflow the task panel", () => {
    expect(styles).toMatch(/\.task-tools\s*\{[^}]*display:\s*flex/u);
    expect(styles).toMatch(/\.task-tools\s*>\s*input\s*\{[^}]*flex:\s*1 1 180px/u);
    expect(styles).toMatch(/\.task-tools\s*>\s*select\s*\{[^}]*flex:\s*0 1 240px/u);
  });

  it("insets custom select carets from the right border", () => {
    expect(styles).toMatch(/\.task-tools select\s*\{[^}]*appearance:\s*none/u);
    expect(styles).toMatch(/\.task-tools select\s*\{[^}]*padding-right:\s*(?:3[2-9]|[4-9]\d)px/u);
    expect(styles).toMatch(/\.task-tools select\s*\{[^}]*background-position:\s*right 14px center/u);
  });
});
