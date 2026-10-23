import { describe, expect, it, vi } from "vitest";

import { ShortcutClient } from "../netlify/functions/lib/automation/shortcut-client.js";
import {
  ACTIVE_SHORTCUT_STATES,
  KYLE_SHORTCUT_MEMBER_ID,
  type ShortcutStory,
} from "../netlify/functions/lib/automation/shortcut-rule.js";
import { HOLD_SHORTCUT_STATES } from "../netlify/functions/lib/automation/shortcut-rule-v2.js";

function story(id: number, workflowStateId: number, ownerIds = [KYLE_SHORTCUT_MEMBER_ID]): ShortcutStory {
  return {
    id,
    app_url: `https://app.shortcut.com/sdg/story/${id}`,
    archived: false,
    name: `Story ${id}`,
    description: "Do the requested work.",
    owner_ids: ownerIds,
    workflow_state_id: workflowStateId,
    custom_fields: [],
    deadline: null,
    updated_at: "2026-08-16T12:00:00Z",
  };
}

describe("Shortcut story observation", () => {
  it("finds only Stories changed inside a bounded polling window", async () => {
    const request = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toEqual({
        updated_at_start: "2026-08-16T11:55:00.000Z",
        updated_at_end: "2026-08-16T12:00:00.000Z",
        includes_description: false,
      });
      return Response.json([{ id: 490801 }, { id: 490802 }, { id: 490801 }]);
    });

    const references = await new ShortcutClient(request as typeof fetch, "shortcut-token")
      .observeChangedStoryReferences(
        new Date("2026-08-16T11:55:00Z"),
        new Date("2026-08-16T12:00:00Z"),
      );

    expect(references).toEqual(["490801", "490802"]);
    expect(request).toHaveBeenCalledWith(
      "https://api.app.shortcut.com/api/v3/stories/search",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("searches only actionable assigned states and separately checks existing Tasks", async () => {
    const actionableStateId = Number(Object.keys(ACTIVE_SHORTCUT_STATES)[0]);
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/stories/search")) {
        const body = JSON.parse(String(init?.body)) as { workflow_state_id: number };
        return Response.json(body.workflow_state_id === actionableStateId ? [story(490801, actionableStateId)] : []);
      }
      if (url.endsWith("/stories/490900")) {
        return Response.json(story(490900, 500000081, []));
      }
      return new Response(null, { status: 404 });
    });

    const result = await new ShortcutClient(request as typeof fetch, "shortcut-token")
      .observeOwnedStories(KYLE_SHORTCUT_MEMBER_ID, ["490900"]);

    expect(result.stories.map(({ id }) => id)).toEqual([490801, 490900]);
    expect(result.unavailableReferences).toEqual([]);
    expect(request).toHaveBeenCalledTimes(Object.keys(ACTIVE_SHORTCUT_STATES).length + 1);

    const searchBodies = request.mock.calls
      .filter(([input]) => String(input).endsWith("/stories/search"))
      .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(searchBodies).toHaveLength(Object.keys(ACTIVE_SHORTCUT_STATES).length);
    expect(searchBodies.every((body) => body.owner_id === KYLE_SHORTCUT_MEMBER_ID)).toBe(true);
    expect(searchBodies.every((body) => body.includes_description === true)).toBe(true);
    expect(new Set(searchBodies.map((body) => body.workflow_state_id))).toEqual(
      new Set(Object.keys(ACTIVE_SHORTCUT_STATES).map(Number)),
    );
  });

  it("finds assigned and requester v2 candidates across active and QA hold states", async () => {
    const stateIds = [...Object.keys(ACTIVE_SHORTCUT_STATES), ...Object.keys(HOLD_SHORTCUT_STATES)].map(Number);
    const firstStateId = stateIds[0];
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (!url.endsWith("/stories/search")) return new Response(null, { status: 404 });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (body.workflow_state_id !== firstStateId) return Response.json([]);
      if (body.owner_id === KYLE_SHORTCUT_MEMBER_ID) return Response.json([story(490801, firstStateId)]);
      if (body.requested_by_id === KYLE_SHORTCUT_MEMBER_ID) {
        return Response.json([{ ...story(490802, firstStateId, []), requested_by_id: KYLE_SHORTCUT_MEMBER_ID }]);
      }
      return Response.json([]);
    });

    const result = await new ShortcutClient(request as typeof fetch, "shortcut-token")
      .observeRuleV2CandidateStories(KYLE_SHORTCUT_MEMBER_ID, []);

    expect(result.stories.map(({ id }) => id)).toEqual([490801, 490802]);
    expect(request).toHaveBeenCalledTimes(stateIds.length * 2);
  });

  it("loads the union of personally owned and requested Stories for the Shortcut Board", async () => {
    const stateId = Number(Object.keys(ACTIVE_SHORTCUT_STATES)[0]);
    const request = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (body.owner_id === KYLE_SHORTCUT_MEMBER_ID) {
        return Response.json([story(490801, stateId), story(490803, stateId)]);
      }
      if (body.requested_by_id === KYLE_SHORTCUT_MEMBER_ID) {
        return Response.json([
          { ...story(490802, stateId, []), requested_by_id: KYLE_SHORTCUT_MEMBER_ID },
          { ...story(490803, stateId), requested_by_id: KYLE_SHORTCUT_MEMBER_ID },
        ]);
      }
      return Response.json([]);
    });

    const stories = await new ShortcutClient(request as typeof fetch, "shortcut-token")
      .observePersonalStories(KYLE_SHORTCUT_MEMBER_ID);

    expect(stories.map(({ id }) => id)).toEqual([490801, 490803, 490802]);
    expect(request).toHaveBeenCalledTimes(2);
    const bodies = request.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(bodies).toContainEqual({
      owner_id: KYLE_SHORTCUT_MEMBER_ID,
      archived: false,
      includes_description: false,
    });
    expect(bodies).toContainEqual({
      requested_by_id: KYLE_SHORTCUT_MEMBER_ID,
      archived: false,
      includes_description: false,
    });
  });

  it("enriches Shortcut Stories with their Epic names", async () => {
    const stateId = Number(Object.keys(ACTIVE_SHORTCUT_STATES)[0]);
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/epics/459966")) {
        return Response.json({ id: 459966, name: "Browns" });
      }
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (body.owner_id === KYLE_SHORTCUT_MEMBER_ID) {
        return Response.json([{ ...story(490801, stateId), epic_id: 459966 }]);
      }
      return Response.json([]);
    });

    const stories = await new ShortcutClient(request as typeof fetch, "shortcut-token")
      .observePersonalStories(KYLE_SHORTCUT_MEMBER_ID);

    expect(stories[0]).toMatchObject({ epic_id: 459966, epic_name: "Browns" });
    expect(request).toHaveBeenCalledWith(
      "https://api.app.shortcut.com/api/v3/epics/459966",
      expect.any(Object),
    );
  });

  it("loads comment authorship, mentions, and thread relationships for Heads Up evaluation", async () => {
    const request = vi.fn(async () => Response.json([{
      id: 9001,
      app_url: "https://app.shortcut.com/sdg/story/490801#activity-9001",
      author_id: "5c943134-052d-48f6-a51c-f29504d33c6a",
      member_mention_ids: [KYLE_SHORTCUT_MEMBER_ID],
      parent_id: null,
      text: "@Kyle please confirm the launch date.",
      deleted: false,
      created_at: "2026-08-16T12:00:00Z",
      updated_at: "2026-08-16T12:00:00Z",
    }]));

    const comments = await new ShortcutClient(request as typeof fetch, "shortcut-token")
      .observeStoryComments("490801");

    expect(comments[0]).toMatchObject({
      id: 9001,
      member_mention_ids: [KYLE_SHORTCUT_MEMBER_ID],
      parent_id: null,
    });
    expect(request).toHaveBeenCalledWith(
      "https://api.app.shortcut.com/api/v3/stories/490801/comments",
      expect.any(Object),
    );
  });
});
