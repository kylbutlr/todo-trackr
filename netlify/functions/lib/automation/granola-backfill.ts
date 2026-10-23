import { extractGranolaActionCandidates } from "./granola-actions.js";
import { getGranolaNote, listGranolaNotes } from "./granola-client.js";
import { recordGranolaReviewRun, saveGranolaReviewCandidates } from "./granola-repository.js";

type GranolaBackfillDependencies = {
  listNotes: typeof listGranolaNotes;
  getNote: typeof getGranolaNote;
  saveReviewCandidates: typeof saveGranolaReviewCandidates;
  recordRun: typeof recordGranolaReviewRun;
};

export type GranolaBackfillResult = {
  notesScanned: number;
  explicitActions: number;
  reviewCandidates: number;
  created: number;
  skipped: number;
};

const defaultDependencies: GranolaBackfillDependencies = {
  listNotes: listGranolaNotes,
  getNote: getGranolaNote,
  saveReviewCandidates: saveGranolaReviewCandidates,
  recordRun: recordGranolaReviewRun,
};

export async function backfillRecentGranolaNotes(
  apiKey: string,
  options: {
    days?: number;
    now?: Date;
    updatedAfter?: Date | string;
    trigger?: "manual" | "scheduled";
  } = {},
  dependencies: Partial<GranolaBackfillDependencies> = {},
): Promise<GranolaBackfillResult> {
  const deps = { ...defaultDependencies, ...dependencies };
  const days = Math.max(1, Math.min(options.days ?? 7, 30));
  const now = options.now ?? new Date();
  const trigger = options.trigger ?? "manual";
  const updatedAfter = options.updatedAfter
    ? new Date(options.updatedAfter).toISOString()
    : new Date(now.getTime() - days * 24 * 60 * 60 * 1_000).toISOString();
  const noteIds: string[] = [];
  let cursor: string | null = null;

  try {
    for (let page = 0; page < 10; page += 1) {
      const result = await deps.listNotes({ updatedAfter, cursor, pageSize: 30 }, apiKey);
      noteIds.push(...result.notes.map(({ id }) => id));
      if (!result.hasMore || !result.cursor) break;
      cursor = result.cursor;
    }

    let explicitActionCount = 0;
    let reviewCandidateCount = 0;
    for (const noteId of [...new Set(noteIds)]) {
      const note = await deps.getNote(noteId, apiKey);
      const candidates = extractGranolaActionCandidates(note);
      explicitActionCount += candidates.length;
      reviewCandidateCount += await deps.saveReviewCandidates(note.id, candidates);
    }

    const result = {
      notesScanned: noteIds.length,
      explicitActions: explicitActionCount,
      reviewCandidates: reviewCandidateCount,
      created: 0,
      skipped: 0,
    };
    await deps.recordRun(trigger, "succeeded", {
      notes: result.notesScanned,
      review: result.reviewCandidates,
      candidates: result.explicitActions,
    });
    return result;
  } catch (error) {
    await deps.recordRun(
      trigger,
      "failed",
      { notes: noteIds.length },
      error instanceof Error ? error.message : "Unexpected Granola scan failure.",
    ).catch(() => undefined);
    throw error;
  }
}
