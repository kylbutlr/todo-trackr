import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const highFrequencyDatabaseSchedules = [
  {
    path: new URL("../netlify/functions/task-alarms-scheduled.mts", import.meta.url),
    cron: 'schedule: "* * * * *"',
  },
  {
    path: new URL("../netlify/functions/shortcut-incremental-scheduled.mts", import.meta.url),
    cron: 'schedule: "*/2 * * * *"',
  },
  {
    path: new URL("../netlify/functions/granola-scheduled.mts", import.meta.url),
    cron: 'schedule: "*/5 * * * *"',
  },
];

describe("scheduled Neon compute budget", () => {
  it("leaves more than five idle minutes between unattended database wakes", () => {
    const offenders = highFrequencyDatabaseSchedules.flatMap(({ path, cron }) => {
      if (!existsSync(path)) return [];
      return readFileSync(path, "utf8").includes(cron) ? [path.pathname] : [];
    });

    expect(offenders).toEqual([]);
  });

  it("aligns optional repair jobs into one six-hour database wake window", () => {
    const expectedSchedule = 'schedule: "17 */6 * * *"';
    const repairSchedules = [
      new URL("../netlify/functions/granola-scheduled.mts", import.meta.url),
      new URL("../netlify/functions/shortcut-scheduled.mts", import.meta.url),
    ];

    for (const path of repairSchedules) {
      expect(readFileSync(path, "utf8"), path.pathname).toContain(expectedSchedule);
    }
  });

  it("documents repair kill switches and the Neon usage verification loop", () => {
    const environment = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    const runbook = readFileSync(new URL("../docs/neon-compute-budget.md", import.meta.url), "utf8");

    expect(environment).toContain("TODO_TRACKER_GRANOLA_REPAIR_ENABLED=true");
    expect(environment).toContain("TODO_TRACKER_SHORTCUT_REPAIR_ENABLED=true");
    expect(runbook).toContain("Usage");
    expect(runbook).toContain("Compute");
    expect(runbook).toContain("Idle");
    expect(runbook).toContain("24 hours");
    expect(runbook).toContain("TODO_TRACKER_GRANOLA_REPAIR_ENABLED");
    expect(runbook).toContain("TODO_TRACKER_SHORTCUT_REPAIR_ENABLED");
  });
});
