import { describe, expect, it } from "vitest";

import { schedulerExpectedWithinMinutes } from "../netlify/functions/lib/system-health.js";

describe("System Health repair expectations", () => {
  it("allows two six-hour repair windows before reporting stale", () => {
    expect(schedulerExpectedWithinMinutes("shortcut", true)).toBe(720);
    expect(schedulerExpectedWithinMinutes("granola", true)).toBe(720);
  });

  it("does not expect a scheduler that is deliberately disabled", () => {
    expect(schedulerExpectedWithinMinutes("shortcut", false)).toBeNull();
    expect(schedulerExpectedWithinMinutes("granola", false)).toBeNull();
  });
});
