export type SourceExcerptInput = {
  title: string;
  description: string;
};

const MAX_EXCERPT_LENGTH = 240;
const SECTION_LABEL = /^(?:acceptance criteria|approved tickets?|background|context|description|dev notes|notes|objective|overview|primary reference|reference parents?|request|requirements|scope|screenshots?|summary|train|user story)\s*:?$/iu;
const MARKDOWN_LINK_ONLY = /^\s*!?\[[^\]]*\]\([^)]*\)\s*$/u;
const UPPERCASE_LEADING_LABEL = /^(?:CONTEXT|DESCRIPTION|OBJECTIVE|OVERVIEW|REQUEST|SUMMARY)\s+(?=\S)/u;
const TITLE_CASE_LEADING_LABEL = /^(?:Objective|Overview)\s+(?=[A-Z])/u;
const LABELED_PREFIX = /^(?:date\s*&\s*time|context|description|objective|overview|request|summary|train)\s*[:=\-]\s*/iu;
const TRAILING_REFERENCE = /(?:^|\s)(?:approved tickets?|notes?|primary reference|reference parents?|screenshots?)\s*[:=].*$/iu;
const BARE_URL = /\bhttps?:\/\/[^\s<]+/giu;
const TEMPLATE_INSTRUCTION = /^(?:please\s+)?(?:refer to|review|see|use)\b.*\b(?:client|document|figma|link|notes?|scope|screenshots?)\b[\s:;,.\-]*$/iu;

function cleanLine(line: string): string {
  return line
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)/u, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<https?:\/\/[^>]+>/gu, "")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[`*_~]/gu, "")
    .replace(UPPERCASE_LEADING_LABEL, "")
    .replace(TITLE_CASE_LEADING_LABEL, "")
    .replace(LABELED_PREFIX, "")
    .replace(TRAILING_REFERENCE, "")
    .replace(BARE_URL, "")
    .replace(/\s+/gu, " ")
    .replace(/[\s:;=\-]+$/gu, "")
    .trim();
}

function isNaturalLanguage(value: string): boolean {
  if (TEMPLATE_INSTRUCTION.test(value)) return false;
  const words = value.match(/\p{L}[\p{L}\p{N}'’/-]*/gu) ?? [];
  return value.length >= 16 && words.length >= 3;
}

function meaningfulText(description: string): string | null {
  const withoutCode = description
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/^\s*(?:---+|___+|\*\*\*+)\s*$/gmu, " ");

  const paragraphs = withoutCode.split(/\r?\n\s*\r?\n/gu).map((paragraph) => paragraph
      .split(/\r?\n/gu)
      .filter((line) => !MARKDOWN_LINK_ONLY.test(line))
      .map(cleanLine)
      .filter((line) => line.length > 0 && !SECTION_LABEL.test(line) && !TEMPLATE_INSTRUCTION.test(line))
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim())
    .filter(isNaturalLanguage);

  return paragraphs[0] ?? null;
}

function firstTwoSentences(value: string): string {
  const sentences = value.match(/[^.!?]+(?:[.!?]+|$)/gu) ?? [];
  return sentences.slice(0, 2).join(" ").replace(/\s+/gu, " ").trim();
}

function truncateAtWord(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) return value;

  const candidate = value.slice(0, maximumLength - 1).trimEnd();
  const lastSpace = candidate.lastIndexOf(" ");
  const trimmed = lastSpace >= Math.floor(maximumLength * 0.65)
    ? candidate.slice(0, lastSpace)
    : candidate;
  return `${trimmed.replace(/[,:;\-\s]+$/gu, "")}…`;
}

export function sourceExcerpt(input: SourceExcerptInput): string | null {
  const description = meaningfulText(input.description);
  return description ? truncateAtWord(firstTwoSentences(description), MAX_EXCERPT_LENGTH) : null;
}

export async function generateSourceExcerpts(inputs: SourceExcerptInput[]): Promise<Array<string | null>> {
  return inputs.map(sourceExcerpt);
}
