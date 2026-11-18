import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseCodexReference } from "../netlify/functions/lib/automation/codex-repository.js";

const root = new URL("../", import.meta.url);

describe("Codex Work Sessions", () => {
  it("parses a conversation URL without inventing a public deep link", () => {
    expect(parseCodexReference("https://chatgpt.com/codex/tasks/thread-123?view=full")).toEqual({
      threadId: "thread-123",
      threadUrl: "https://chatgpt.com/codex/tasks/thread-123?view=full",
    });
  });

  it("accepts a raw thread ID and leaves its URL unset", () => {
    expect(parseCodexReference("thread-123")).toEqual({
      threadId: "thread-123",
      threadUrl: null,
    });
  });

  it("rejects a URL that is not a Codex conversation host", () => {
    expect(() => parseCodexReference("https://example.com/thread-123")).toThrow(
      "Enter a Codex conversation URL from ChatGPT or a raw thread ID.",
    );
  });

  it("keeps Codex separate from task sources and exposes both client surfaces", () => {
    const migration = readFileSync(new URL("database/migrations/0012_codex_sessions.sql", root), "utf8");
    const web = readFileSync(new URL("apps/web/src/App.tsx", root), "utf8");
    const native = readFileSync(new URL("apps/macos/Sources/Views/TaskDetailView.swift", root), "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS codex_sessions");
    expect(migration).not.toContain("ALTER TABLE tasks\n  DROP CONSTRAINT");
    expect(web).toContain("Codex work session");
    expect(web).toContain("Needs you");
    expect(native).toContain('Section("Codex Work Session")');
    expect(native).toContain('Link("Open in Codex"');
  });

  it("publishes an authenticated observation endpoint", () => {
    const api = readFileSync(new URL("netlify/functions/api.mts", root), "utf8");
    const docs = readFileSync(new URL("docs/codex-work-sessions.md", root), "utf8");

    expect(api).toContain('pathname === "/api/ingest/codex/sessions"');
    expect(api).toContain("requireAutomationIngestAuthorization(request)");
    expect(docs).toContain("TODO_TRACKR_INGEST_TOKEN");
  });
});
