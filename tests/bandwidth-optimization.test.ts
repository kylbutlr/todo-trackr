import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { conditionalJson } from "../netlify/functions/lib/http.js";
import { taskListQuery } from "../netlify/functions/lib/tasks.js";
import { nextTaskPollIntervalMs, shouldPollWorkspace } from "../apps/web/src/workspaceRefreshPolicy.js";

const workspace = readFileSync(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");

describe("bandwidth optimization", () => {
  it("returns an empty 304 response when the client already has the Task snapshot", async () => {
    const initial = conditionalJson(
      new Request("https://todotrackr.test/api/tasks"),
      { tasks: [{ id: "task-1", status: "open" }] },
    );
    const etag = initial.headers.get("etag");

    expect(initial.status).toBe(200);
    expect(etag).toBeTruthy();

    const unchanged = conditionalJson(
      new Request("https://todotrackr.test/api/tasks", {
        headers: { "if-none-match": etag! },
      }),
      { tasks: [{ id: "task-1", status: "open" }] },
    );

    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe("");
    expect(unchanged.headers.get("cache-control")).toBe("private, no-cache");
  });

  it("can query only open Tasks for frequent native refreshes", () => {
    const query = taskListQuery("open");

    expect(query.text).toContain("WHERE tasks.deleted_at IS NULL AND tasks.status = $1");
    expect(query.values).toEqual(["open"]);
  });

  it("does not poll the workspace while its browser tab is hidden", () => {
    expect(shouldPollWorkspace("visible")).toBe(true);
    expect(shouldPollWorkspace("hidden")).toBe(false);
    expect(workspace).toContain('workspaceModeRef.current === "tasks" && !isConnectionView(viewRef.current)');
    expect(workspace).toContain("void load(false)");
    expect(workspace).toContain("window.setInterval(refreshWhenVisible, WORKSPACE_POLL_INTERVAL_MS)");
    expect([0, 1, 2, 3].map(nextTaskPollIntervalMs)).toEqual([30_000, 60_000, 120_000, 600_000]);
  });
});
