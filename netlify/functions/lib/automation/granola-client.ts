import { z } from "zod";

const granolaNoteSchema = z.object({
  id: z.string().min(1),
  title: z.preprocess(
    (value) => typeof value === "string" && value.trim() ? value : "Untitled meeting",
    z.string(),
  ),
  updated_at: z.string().min(1),
  web_url: z.url(),
  summary_text: z.string().nullable().default(null),
  summary_markdown: z.string().nullable().default(null),
}).passthrough();

export type GranolaNote = z.infer<typeof granolaNoteSchema>;

const granolaNoteListItemSchema = z.object({
  id: z.string().min(1),
  updated_at: z.string().min(1),
}).passthrough();

const granolaNoteListSchema = z.object({
  notes: z.array(granolaNoteListItemSchema),
  hasMore: z.boolean(),
  cursor: z.string().nullable(),
});

export type GranolaNoteList = z.infer<typeof granolaNoteListSchema>;

export async function listGranolaNotes(
  options: { updatedAfter: string; cursor?: string | null; pageSize?: number },
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<GranolaNoteList> {
  const url = new URL("https://public-api.granola.ai/v1/notes");
  url.searchParams.set("updated_after", options.updatedAfter);
  url.searchParams.set("page_size", String(Math.max(1, Math.min(options.pageSize ?? 30, 30))));
  if (options.cursor) url.searchParams.set("cursor", options.cursor);

  const response = await fetcher(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Granola returned HTTP ${response.status} while listing recent notes.`);
  }
  return granolaNoteListSchema.parse(await response.json());
}

export async function getGranolaNote(
  noteId: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<GranolaNote> {
  const response = await fetcher(`https://public-api.granola.ai/v1/notes/${encodeURIComponent(noteId)}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Granola returned HTTP ${response.status} while loading note ${noteId}.`);
  }
  return granolaNoteSchema.parse(await response.json());
}
