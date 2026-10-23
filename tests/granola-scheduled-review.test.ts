import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  granolaScheduledScanIsDue,
  granolaScanStart,
  isValidGranolaSchedule,
  nextGranolaScanAt,
} from "../netlify/functions/lib/automation/granola-repository.js";

const repositoryRoot = new URL("../", import.meta.url);

describe("Granola scheduled review discovery", () => {
  it("uses shared quarter-hour scan boundaries", () => {
    expect(nextGranolaScanAt(new Date("2026-08-17T16:07:30.000Z"))).toBe("2026-08-17T16:15:00.000Z");
    expect(nextGranolaScanAt(new Date("2026-08-17T16:07:30.000Z"), 15, 5)).toBe("2026-08-17T16:20:00.000Z");
  });

  it("recognizes a configured scan slot after a delayed check", () => {
    expect(isValidGranolaSchedule(15, 5)).toBe(true);
    expect(isValidGranolaSchedule(15, 7)).toBe(false);
    expect(isValidGranolaSchedule(10, 10)).toBe(false);
    expect(granolaScheduledScanIsDue(
      new Date("2026-08-17T16:05:00.000Z"),
      "2026-08-17T15:50:00.000Z",
      15,
      5,
    )).toBe(true);
    expect(granolaScheduledScanIsDue(
      new Date("2026-08-17T16:00:00.000Z"),
      "2026-08-17T15:50:00.000Z",
      15,
      5,
    )).toBe(false);
  });

  it("repairs from the last successful scan with a five-minute overlap", () => {
    expect(granolaScanStart(
      "2026-08-17T16:15:00.000Z",
      new Date("2026-08-17T16:30:00.000Z"),
    )).toBe("2026-08-17T16:10:00.000Z");
  });

  it("uses a seven-day recovery window before the first successful scan", () => {
    expect(granolaScanStart(null, new Date("2026-08-17T16:30:00.000Z")))
      .toBe("2026-08-10T16:30:00.000Z");
  });

  it("runs a private review-only reconciliation on a six-hour repair schedule", () => {
    const scheduled = readFileSync(new URL("netlify/functions/granola-scheduled.mts", repositoryRoot), "utf8");
    const repair = readFileSync(new URL("netlify/functions/granola-repair.mts", repositoryRoot), "utf8");
    const webhook = readFileSync(new URL("netlify/functions/lib/automation/granola-webhook.ts", repositoryRoot), "utf8");
    const backfill = readFileSync(new URL("netlify/functions/lib/automation/granola-backfill.ts", repositoryRoot), "utf8");
    const api = readFileSync(new URL("netlify/functions/api.mts", repositoryRoot), "utf8");
    const application = readFileSync(new URL("apps/web/src/App.tsx", repositoryRoot), "utf8");

    expect(scheduled).toContain('schedule: "17 */6 * * *"');
    expect(scheduled).toContain("/.netlify/functions/granola-repair");
    expect(repair).toContain("background: true");
    expect(repair).not.toContain("granolaScheduledScanDue");
    expect(repair).toContain('trigger: "scheduled"');
    expect(webhook).not.toContain("ingestGranolaActions");
    expect(backfill).not.toContain("ingestGranolaActions");
    expect(api).not.toContain("ingestGranolaActions(input)");
    expect(api).toContain("queueGranolaActionsForReview(input)");
    expect(application).toContain("Repair schedule");
    expect(application).toContain("Every six hours");
    expect(application).toContain("Every Granola Task requires your approval");
    expect(application).not.toContain("Automatic scan schedule");
    expect(application).not.toContain("Next automatic scan");
  });
});
