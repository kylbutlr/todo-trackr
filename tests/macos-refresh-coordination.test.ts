import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const store = readFileSync(
  new URL("../apps/macos/Sources/Stores/TaskStore.swift", import.meta.url),
  "utf8",
);
const app = readFileSync(
  new URL("../apps/macos/Sources/TodoTrackerApp.swift", import.meta.url),
  "utf8",
);
const workspace = readFileSync(
  new URL("../apps/macos/Sources/Views/WorkspaceView.swift", import.meta.url),
  "utf8",
);
const miniDashboard = readFileSync(
  new URL("../apps/macos/Sources/Views/MiniDashboardView.swift", import.meta.url),
  "utf8",
);

describe("macOS refresh coordination", () => {
  it("uses one app-lifetime refresh owner for every native surface", () => {
    expect(app).toContain("store.startAutoRefresh()");
    expect(store).toContain("private var autoRefreshTask");
    expect(workspace).not.toContain("while !Task.isCancelled");
    expect(miniDashboard).not.toContain("while !Task.isCancelled");
  });

  it("uses lightweight visible polling and a five-minute idle cadence", () => {
    expect(store).toContain("TaskRefreshPolicy.interval(isTaskSurfaceVisible:");
    expect(store).toContain("static let visibleTaskInterval = Duration.seconds(30)");
    expect(store).toContain("static let idleTaskInterval = Duration.seconds(300)");
    expect(store).toContain("static let fullRefreshEveryTicks = 10");
    expect(store).toContain("await refreshOpenTasks(showLoading: false)");
    expect(store).toContain("await refresh(showLoading: false)");
  });
});
