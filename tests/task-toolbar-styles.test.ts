import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const controls = readFileSync(new URL("../design/app-stylr-controls.css", import.meta.url), "utf8");
const styles = readFileSync(new URL("../apps/web/src/styles.css", import.meta.url), "utf8");

describe("Task toolbar styles", () => {
  it("shrinks search before filter controls overflow the task panel", () => {
    expect(styles).toMatch(/\.task-tools\s*\{[^}]*display:\s*flex/u);
    expect(styles).toMatch(/\.task-tools\s*>\s*input\s*\{[^}]*flex:\s*1 1 180px/u);
    expect(styles).toMatch(/\.task-tools\s*>\s*select\s*\{[^}]*flex:\s*0 1 240px/u);
  });

  it("uses the shared picker treatment without a competing toolbar caret", () => {
    expect(styles).toContain('@import "../../../design/app-stylr-controls.css"');
    expect(styles).not.toMatch(/\.task-tools select\s*\{[^}]*background-image/u);
    expect(controls).toMatch(/background-position:\s*right 12px center/u);
    expect(controls).toMatch(/select::picker-icon\s*\{[^}]*margin-inline-end:\s*0/u);
  });
});
