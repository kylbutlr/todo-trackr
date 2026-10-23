# Codex Work Sessions

Todo Trackr can attach a Codex conversation to any Task. The Task keeps its original Source, while the Work Session records only the operational state needed for an at-a-glance handoff.

## Current behavior

- Paste a Codex conversation URL or thread ID in Task Details.
- Open the conversation or its pull request from Todo Trackr when a URL is available.
- Review active, Needs You, ready for review, failed, and finished sessions from the Codex Connection page.
- Detach a conversation without deleting the Todo Trackr Task or the Codex conversation.

Todo Trackr does not start an agent, approve an action, copy the full chat, or write to a Source in this foundation release.

## Trusted progress updates

A local bridge or another trusted process can update a Work Session through:

`POST /api/ingest/codex/sessions`

Authenticate with the existing `TODO_TRACKR_INGEST_TOKEN` bearer token. Identify the Task with `taskId`, or provide both `source` and that Source's `externalReference`.

```json
{
  "taskId": "00000000-0000-4000-8000-000000000001",
  "threadId": "codex-thread-id",
  "threadUrl": "https://chatgpt.com/codex/tasks/codex-thread-id",
  "title": "Investigate checkout regression",
  "status": "waiting_for_you",
  "latestSummary": "The implementation is ready, but the visual QA step needs approval.",
  "cwd": "/path/to/repository",
  "branchName": "agent/checkout-regression",
  "prUrl": "https://github.com/example/repository/pull/123"
}
```

Supported states are `linked`, `queued`, `working`, `waiting_for_you`, `ready_for_review`, `failed`, and `finished`.

This endpoint is the stable seam for a later Codex App Server or SDK bridge. Until that bridge owns or observes a Codex runtime, manually attached conversations remain `linked` and Todo Trackr does not claim they are live.
