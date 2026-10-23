import { database } from "./database.js";
import { integrationEnabled } from "./installation.js";
import { buildShortcutPreview, type ShortcutPreview } from "./automation/shortcut-preview.js";
import { loadShortcutConnection, type ShortcutConnectionSnapshot } from "./automation/shortcut-repository.js";

export type ReviewSummary = {
  generatedAt: string;
  total: number;
  sources: {
    granola: number;
    shortcut: number;
  };
};

type ReviewSummaryDependencies = {
  granolaPendingCount: () => Promise<number>;
  shortcutConnection: () => Promise<Pick<ShortcutConnectionSnapshot, "controlMode">>;
  shortcutPreview: () => Promise<Pick<ShortcutPreview, "items">>;
  now: () => Date;
};

async function countPendingGranolaReviews(): Promise<number> {
  const sql = database();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM granola_review_candidates
    WHERE status = 'pending'
  ` as unknown as Array<{ count: number | string }>;
  return Number(rows[0]?.count ?? 0);
}

const defaultDependencies: ReviewSummaryDependencies = {
  granolaPendingCount: countPendingGranolaReviews,
  shortcutConnection: loadShortcutConnection,
  shortcutPreview: () => buildShortcutPreview({
    describeSources: async (inputs) => inputs.map(() => null),
  }),
  now: () => new Date(),
};

export async function loadReviewSummary(
  dependencies: Partial<ReviewSummaryDependencies> = {},
): Promise<ReviewSummary> {
  const deps = { ...defaultDependencies, ...dependencies };
  const [granola, connection] = await Promise.all([
    integrationEnabled("granola") ? deps.granolaPendingCount() : Promise.resolve(0),
    integrationEnabled("shortcut") ? deps.shortcutConnection() : Promise.resolve({ controlMode: "off" as const }),
  ]);
  const shortcut = connection.controlMode === "review"
    ? (await deps.shortcutPreview()).items.filter(({ action }) => action !== "ignore").length
    : 0;

  return {
    generatedAt: deps.now().toISOString(),
    total: granola + shortcut,
    sources: { granola, shortcut },
  };
}
