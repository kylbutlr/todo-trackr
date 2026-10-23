import type { GranolaIngestInput } from "./granola-ingest.js";
import type { GranolaNote } from "./granola-client.js";

const actionSection = /^(?:action items?|next steps?|follow[ -]?ups?|tasks?)$/iu;
const heading = /^#{1,6}\s+(.+?)\s*#*$/u;
const bullet = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(?:\[[ xX]\]\s*)?(.+)$/u;
const kyleAction = /^(?:\*{0,2})?(?:@?kyle(?:\s+butler)?|me)(?:\*{0,2})?\s*(?::|-|\bto\b|\bwill\b|\bshould\b|\bneeds?\s+to\b)\s*(.+)$/iu;
const ownerSuffix = /^(.*?)\s+\(([^)]+)\)\s*[.;]?$/u;
const namedOwnerPrefix = /^(?:\*{0,2})?@?[\p{L}\p{M}][\p{L}\p{M}'’-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'’-]*)?(?:\*{0,2})?\s*:\s*.+$/u;
const kyleOwner = /^(?:@?kyle(?:\s+butler)?|me)$/iu;

export type GranolaActionCandidate = GranolaIngestInput["actions"][number] & {
  responsibility: "explicit";
};

function cleanTitle(value: string): string {
  let title = value.trim().replace(/[.;]\s*$/u, "").trim();
  const strong = title.match(/^(?:\*\*|__)(.+)(?:\*\*|__)$/u);
  if (strong?.[1]) title = strong[1].trim();
  return title;
}

function ownersIncludeKyle(value: string): boolean {
  return value
    .split(/\s*(?:\/|&|,|\band\b)\s*/iu)
    .some((owner) => kyleOwner.test(owner.trim()));
}

function classifyAction(line: string): Pick<GranolaActionCandidate, "responsibility" | "title"> | undefined {
  const prefixMatch = line.match(kyleAction);
  if (prefixMatch?.[1]) {
    const title = cleanTitle(prefixMatch[1]);
    return title ? { responsibility: "explicit", title } : undefined;
  }

  const suffixMatch = line.match(ownerSuffix);
  if (suffixMatch?.[1] && suffixMatch[2]) {
    if (!ownersIncludeKyle(suffixMatch[2])) return undefined;
    const title = cleanTitle(suffixMatch[1]);
    return title ? { responsibility: "explicit", title } : undefined;
  }

  if (namedOwnerPrefix.test(line)) return undefined;
  return undefined;
}

function reference(noteId: string, ordinal: number): string {
  return `${noteId}:action-${ordinal}`;
}

export function extractGranolaActionCandidates(note: GranolaNote): GranolaActionCandidate[] {
  const markdown = note.summary_markdown?.trim();
  if (!markdown) return [];

  const actions: GranolaActionCandidate[] = [];
  let inActionSection = false;
  let actionOrdinal = 0;
  for (const rawLine of markdown.split(/\r?\n/u)) {
    const headingMatch = rawLine.trim().match(heading);
    if (headingMatch) {
      inActionSection = actionSection.test(headingMatch[1].trim());
      continue;
    }
    if (!inActionSection) continue;

    const sourceExcerpt = rawLine.match(bullet)?.[1]?.trim();
    if (!sourceExcerpt) continue;
    actionOrdinal += 1;
    const classified = classifyAction(sourceExcerpt);
    if (!classified) continue;

    actions.push({
      externalReference: reference(note.id, actionOrdinal),
      title: classified.title,
      notes: `From Granola meeting: ${note.title}`,
      sourceUrl: note.web_url,
      sourceExcerpt,
      dueAt: null,
      sourceUpdatedAt: note.updated_at,
      responsibility: classified.responsibility,
    });
  }
  return actions;
}

export function extractGranolaActions(note: GranolaNote): GranolaIngestInput["actions"] {
  return extractGranolaActionCandidates(note)
    .filter(({ responsibility }) => responsibility === "explicit")
    .map(({ responsibility: _responsibility, ...action }) => action);
}
