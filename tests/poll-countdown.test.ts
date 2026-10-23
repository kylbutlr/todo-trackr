import { describe, expect, it } from "vitest";

import { nextPollCountdown } from "../apps/web/src/pollCountdown.js";
import { nextShortcutRepairAt } from "../netlify/functions/lib/automation/shortcut-repository.js";

describe("Shortcut repair countdown", () => {
  it("reports the next shared six-hour repair window", () => {
    expect(nextShortcutRepairAt(new Date("2026-08-16T12:01:15.000Z"))).toBe("2026-08-16T12:17:00.000Z");
  });

  it("counts down and rolls forward after a boundary passes", () => {
    expect(nextPollCountdown(
      new Date("2026-08-16T12:01:15.000Z").getTime(),
      "2026-08-16T12:17:00.000Z",
      21_600,
    )).toBe("15:45");
    expect(nextPollCountdown(
      new Date("2026-08-16T12:17:05.000Z").getTime(),
      "2026-08-16T12:17:00.000Z",
      21_600,
    )).toBe("5:59:55");
  });
});
