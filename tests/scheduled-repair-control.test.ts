import { afterEach, describe, expect, it, vi } from "vitest";

import runGranolaRepair from "../netlify/functions/granola-scheduled.mjs";
import runShortcutRepair from "../netlify/functions/shortcut-scheduled.mjs";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("scheduled repair controls", () => {
  it.each([
    ["Granola", "TODO_TRACKER_GRANOLA_REPAIR_ENABLED", runGranolaRepair],
    ["Shortcut", "TODO_TRACKER_SHORTCUT_REPAIR_ENABLED", runShortcutRepair],
  ])("does not invoke the %s repair endpoint when disabled", async (_name, variable, handler) => {
    const fetchMock = vi.fn();
    vi.stubEnv(variable, "false");
    vi.stubGlobal("fetch", fetchMock);

    await handler(new Request("https://todo-trackr.example"));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
