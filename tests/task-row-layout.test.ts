import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../apps/web/src/styles.css", import.meta.url),
  "utf8",
);

describe("Task row layout", () => {
  it("lets wrapped titles determine the row height", () => {
    const taskRowRule = styles.match(/\.task-row\s*\{([^}]*)\}/u)?.[1] ?? "";

    expect(taskRowRule).not.toContain("max-height");
    expect(taskRowRule).not.toContain("overflow: hidden");
    expect(taskRowRule).toContain("align-items: flex-start");
  });

  it("wraps long titles and aligns controls with the first line", () => {
    expect(styles).toMatch(/\.task-title\s*\{[^}]*flex-wrap: wrap;[^}]*overflow-wrap: anywhere;/u);
    expect(styles).toMatch(/\.task-row\s*\{[^}]*grid-template-columns: 24px minmax\(0, 1fr\) auto;/u);
    expect(styles).toContain(".task-row-leading");
    expect(styles).toContain(".task-source-reference");
  });
});
