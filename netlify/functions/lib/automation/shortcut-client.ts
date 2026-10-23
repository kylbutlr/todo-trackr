import { z } from "zod";

import { requireEnvironment } from "../config.js";
import { HttpError } from "../http.js";
import {
  ACTIVE_SHORTCUT_STATES,
  shortcutStorySchema,
  type ShortcutStory,
  type ShortcutStateMap,
} from "./shortcut-rule.js";
import {
  HOLD_SHORTCUT_STATES,
  shortcutCommentSchema,
  type ShortcutComment,
} from "./shortcut-rule-v2.js";

const shortcutStoriesSchema = z.array(shortcutStorySchema);
const changedShortcutStoriesSchema = z.array(z.object({
  id: z.number().int().positive(),
}));
const shortcutCommentsSchema = z.array(shortcutCommentSchema);
const shortcutEpicSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
});

export type ShortcutWorkflowState = {
  id: number;
  name: string;
  type: "backlog" | "unstarted" | "started" | "done";
  workflowName: string;
};

export type ShortcutStorySet = {
  stories: ShortcutStory[];
  unavailableReferences: string[];
};

export class ShortcutClient {
  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly token: string = requireEnvironment("SHORTCUT_API_TOKEN"),
  ) {}

  async observeOwnedStories(ownerId: string, existingReferences: string[], activeStates: ShortcutStateMap = ACTIVE_SHORTCUT_STATES): Promise<ShortcutStorySet> {
    const actionableResults = await Promise.all(
      Object.keys(activeStates).map((workflowStateId) => this.shortcutRequest("/stories/search", {
        method: "POST",
        body: JSON.stringify({
          owner_id: ownerId,
          workflow_state_id: Number(workflowStateId),
          archived: false,
          includes_description: true,
        }),
      })),
    );
    const ownedStories = [...new Map(
      actionableResults
        .flatMap((result) => shortcutStoriesSchema.parse(result))
        .map((story) => [story.id, story]),
    ).values()];
    const ownedReferences = new Set(ownedStories.map((story) => String(story.id)));
    const missingReferences = existingReferences.filter((reference) => !ownedReferences.has(reference));

    const missingResults = await Promise.all(missingReferences.map(async (reference) => {
      const response = await this.shortcutRequest(`/stories/${encodeURIComponent(reference)}`, {}, true);
      return response === undefined
        ? { reference, story: undefined }
        : { reference, story: shortcutStorySchema.parse(response) };
    }));

    return {
      stories: await this.enrichStoriesWithEpicNames([
        ...ownedStories,
        ...missingResults.flatMap(({ story }) => story ? [story] : []),
      ]),
      unavailableReferences: missingResults
        .filter(({ story }) => story === undefined)
        .map(({ reference }) => reference),
    };
  }

  async workflowStates(): Promise<ShortcutWorkflowState[]> {
    const workflows = z.array(z.object({
      id: z.number().int().positive(), name: z.string().min(1),
      states: z.array(z.object({ id: z.number().int().positive(), name: z.string().min(1), type: z.enum(["backlog", "unstarted", "started", "done"]), })),
    })).parse(await this.shortcutRequest("/workflows"));
    return workflows.flatMap((workflow) => workflow.states.map((state) => ({ ...state, workflowName: workflow.name })));
  }

  async observePersonalStories(memberId: string): Promise<ShortcutStory[]> {
    const results = await Promise.all([
      this.shortcutRequest("/stories/search", {
        method: "POST",
        body: JSON.stringify({
          owner_id: memberId,
          archived: false,
          includes_description: false,
        }),
      }),
      this.shortcutRequest("/stories/search", {
        method: "POST",
        body: JSON.stringify({
          requested_by_id: memberId,
          archived: false,
          includes_description: false,
        }),
      }),
    ]);

    return this.enrichStoriesWithEpicNames([...new Map(
      results
        .flatMap((result) => shortcutStoriesSchema.parse(result))
        .map((story) => [story.id, story]),
    ).values()]);
  }

  async observeRuleV2CandidateStories(memberId: string, existingReferences: string[]): Promise<ShortcutStorySet> {
    const candidateStateIds = [
      ...Object.keys(ACTIVE_SHORTCUT_STATES),
      ...Object.keys(HOLD_SHORTCUT_STATES),
    ].map(Number);
    const candidateResults = await Promise.all(candidateStateIds.flatMap((workflowStateId) => [
      this.shortcutRequest("/stories/search", {
        method: "POST",
        body: JSON.stringify({
          owner_id: memberId,
          workflow_state_id: workflowStateId,
          archived: false,
          includes_description: true,
        }),
      }),
      this.shortcutRequest("/stories/search", {
        method: "POST",
        body: JSON.stringify({
          requested_by_id: memberId,
          workflow_state_id: workflowStateId,
          archived: false,
          includes_description: true,
        }),
      }),
    ]));
    const candidateStories = [...new Map(
      candidateResults
        .flatMap((result) => shortcutStoriesSchema.parse(result))
        .map((story) => [story.id, story]),
    ).values()];
    const candidateReferences = new Set(candidateStories.map((story) => String(story.id)));
    const missingReferences = existingReferences.filter((reference) => !candidateReferences.has(reference));
    const missingResults = await Promise.all(missingReferences.map(async (reference) => {
      const response = await this.shortcutRequest(`/stories/${encodeURIComponent(reference)}`, {}, true);
      return response === undefined
        ? { reference, story: undefined }
        : { reference, story: shortcutStorySchema.parse(response) };
    }));

    return {
      stories: await this.enrichStoriesWithEpicNames([
        ...candidateStories,
        ...missingResults.flatMap(({ story }) => story ? [story] : []),
      ]),
      unavailableReferences: missingResults
        .filter(({ story }) => story === undefined)
        .map(({ reference }) => reference),
    };
  }

  async observeStoryComments(reference: string): Promise<ShortcutComment[]> {
    return shortcutCommentsSchema.parse(await this.shortcutRequest(
      `/stories/${encodeURIComponent(reference)}/comments`,
    ));
  }

  async observeStoriesByReferences(references: string[]): Promise<ShortcutStorySet> {
    const uniqueReferences = [...new Set(references)];
    const results = await Promise.all(uniqueReferences.map(async (reference) => {
      const response = await this.shortcutRequest(`/stories/${encodeURIComponent(reference)}`, {}, true);
      return response === undefined
        ? { reference, story: undefined }
        : { reference, story: shortcutStorySchema.parse(response) };
    }));

    return {
      stories: await this.enrichStoriesWithEpicNames(
        results.flatMap(({ story }) => story ? [story] : []),
      ),
      unavailableReferences: results
        .filter(({ story }) => story === undefined)
        .map(({ reference }) => reference),
    };
  }

  async observeChangedStoryReferences(start: Date, end: Date): Promise<string[]> {
    const stories = changedShortcutStoriesSchema.parse(await this.shortcutRequest("/stories/search", {
      method: "POST",
      body: JSON.stringify({
        updated_at_start: start.toISOString(),
        updated_at_end: end.toISOString(),
        includes_description: false,
      }),
    }));

    return [...new Set(stories.map(({ id }) => String(id)))];
  }

  private async enrichStoriesWithEpicNames(stories: ShortcutStory[]): Promise<ShortcutStory[]> {
    const epicIds = [...new Set(stories.flatMap(({ epic_id: epicId }) => epicId ? [epicId] : []))];
    if (epicIds.length === 0) return stories;

    const epics = await Promise.all(epicIds.map(async (epicId) => {
      const response = await this.shortcutRequest(`/epics/${epicId}`, {}, true);
      return response === undefined ? undefined : shortcutEpicSchema.parse(response);
    }));
    const epicNames = new Map(epics.flatMap((epic) => epic ? [[epic.id, epic.name] as const] : []));

    return stories.map((story) => ({
      ...story,
      epic_name: story.epic_id ? epicNames.get(story.epic_id) ?? null : null,
    }));
  }

  private async shortcutRequest(
    path: string,
    init: RequestInit = {},
    allowNotFound = false,
  ): Promise<unknown | undefined> {
    let response: Response;
    try {
      response = await this.request(`https://api.app.shortcut.com/api/v3${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          "shortcut-token": this.token,
          ...init.headers,
        },
      });
    } catch {
      throw new HttpError(503, "Shortcut could not be reached. No Tasks were changed.");
    }

    if (allowNotFound && response.status === 404) return undefined;
    if (response.status === 401) {
      throw new HttpError(502, "Shortcut authentication failed. Check SHORTCUT_API_TOKEN.");
    }
    if (response.status === 429) {
      throw new HttpError(503, "Shortcut rate limit reached. Try the preview again shortly.");
    }
    if (!response.ok) {
      throw new HttpError(502, `Shortcut returned HTTP ${response.status}. No Tasks were changed.`);
    }

    return response.json();
  }
}
