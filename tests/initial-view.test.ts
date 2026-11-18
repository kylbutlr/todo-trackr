import { describe, expect, it } from "vitest";

import { initialConnectionView } from "../apps/web/src/initialView.js";

describe("initial connection view", () => {
  it.each([
    ["?view=connection%3Agranola", "connection:granola"],
    ["?view=connection%3Ashortcut", "connection:shortcut"],
    ["?view=connection%3Acodex", "inbox"],
    ["?view=source%3Agranola", "inbox"],
    ["", "inbox"],
  ])("maps %s to %s", (search, expected) => {
    expect(initialConnectionView(search)).toBe(expected);
  });
});
