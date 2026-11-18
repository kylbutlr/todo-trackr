import { z } from "zod";

import { database } from "../database.js";
import { HttpError } from "../http.js";
import { ShortcutClient } from "./shortcut-client.js";
import {
  ACTIVE_SHORTCUT_STATES,
  KYLE_SHORTCUT_MEMBER_ID,
  normalizeShortcutStory,
  type ShortcutPriority,
  type ShortcutSize,
  type ShortcutStory,
} from "./shortcut-rule.js";

export const SHORTCUT_BOARD_STATES = {
  ...ACTIVE_SHORTCUT_STATES,
  500000080: "Blocked",
  500019424: "Pending Ops",
  500130176: "Pending Client",
} as const;

export type ShortcutBoardStory = {
  externalReference: string;
  sourceUrl: string;
  title: string;
  priority: ShortcutPriority;
  size: ShortcutSize;
  dueDate: string | null;
  workflowStateName: string;
  ownerIds: string[];
  requestedById: string | null;
  matchesOwner: boolean;
  matchesRequester: boolean;
  isStarred: boolean;
  sourceUpdatedAt: string | null;
  epicName: string | null;
};

export type ShortcutBoardSnapshot = {
  generatedAt: string;
  memberId: string;
  stories: ShortcutBoardStory[];
};

type ShortcutBoardPreferenceRow = {
  external_reference: string;
  is_starred: boolean;
};

export const shortcutBoardStarSchema = z.object({
  isStarred: z.boolean(),
});

function isBoardState(workflowStateId: number | null): workflowStateId is keyof typeof SHORTCUT_BOARD_STATES {
  return workflowStateId !== null && Object.hasOwn(SHORTCUT_BOARD_STATES, workflowStateId);
}

export function buildShortcutBoardStories(
  stories: ShortcutStory[],
  starredReferences: Set<string> = new Set(),
): ShortcutBoardStory[] {
  return stories.flatMap((story) => {
    if (story.archived || !isBoardState(story.workflow_state_id)) return [];

    const matchesOwner = story.owner_ids.includes(KYLE_SHORTCUT_MEMBER_ID);
    const matchesRequester = story.requested_by_id === KYLE_SHORTCUT_MEMBER_ID;
    if (!matchesOwner && !matchesRequester) return [];

    const observation = normalizeShortcutStory(story);
    return [{
      externalReference: observation.externalReference,
      sourceUrl: observation.sourceUrl,
      title: observation.title,
      priority: observation.priority,
      size: observation.size,
      dueDate: observation.dueDate,
      workflowStateName: SHORTCUT_BOARD_STATES[story.workflow_state_id],
      ownerIds: story.owner_ids,
      requestedById: story.requested_by_id ?? null,
      matchesOwner,
      matchesRequester,
      isStarred: starredReferences.has(observation.externalReference),
      sourceUpdatedAt: observation.sourceUpdatedAt,
      epicName: observation.epicName,
    }];
  });
}

async function loadStarredReferences(): Promise<Set<string>> {
  try {
    const sql = database();
    const rows = (await sql`
      SELECT external_reference, is_starred
      FROM shortcut_board_preferences
      WHERE is_starred = true
    `) as ShortcutBoardPreferenceRow[];
    return new Set(rows.map((row) => row.external_reference));
  } catch (error) {
    if (error instanceof Error && /shortcut_board_preferences/u.test(error.message)) {
      throw new HttpError(503, "Shortcut Board preferences are unavailable. Apply migration 0011.");
    }
    throw error;
  }
}

export async function loadShortcutBoard(
  client: ShortcutClient = new ShortcutClient(),
): Promise<ShortcutBoardSnapshot> {
  const [stories, starredReferences] = await Promise.all([
    client.observePersonalStories(KYLE_SHORTCUT_MEMBER_ID),
    loadStarredReferences(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    memberId: KYLE_SHORTCUT_MEMBER_ID,
    stories: buildShortcutBoardStories(stories, starredReferences),
  };
}

export async function setShortcutBoardStar(
  externalReference: string,
  isStarred: boolean,
): Promise<void> {
  try {
    const sql = database();
    await sql`
      INSERT INTO shortcut_board_preferences (
        external_reference,
        is_starred,
        updated_at
      ) VALUES (
        ${externalReference},
        ${isStarred},
        now()
      )
      ON CONFLICT (external_reference) DO UPDATE SET
        is_starred = EXCLUDED.is_starred,
        updated_at = now()
    `;
  } catch (error) {
    if (error instanceof Error && /shortcut_board_preferences/u.test(error.message)) {
      throw new HttpError(503, "Shortcut Board preferences are unavailable. Apply migration 0011.");
    }
    throw error;
  }
}
