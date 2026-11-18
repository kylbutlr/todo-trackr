# Snippet release recovery: 0.2.69

## Baseline

The installed bundle reported 0.2.54 (2054), while the public appcast advertised 0.2.68 (2068). The original snippet installation had used a stale 0.2.54 checkout.

Recovery starts at freshly fetched `origin/main` commit `34f11b0fd0f6cf352a3c129a28246a87d951caa7` in isolated branch `kylebutler/snippet-release-recovery`. Main already contains the snippet feature and typo-correction fixes, so no unrelated changes were copied from the dirty checkout. All native source and tests remain identical to that main revision; only release metadata advances to 0.2.69 (2069).

The original checkout is preserved. A before/after SHA-256 comparison matched all 38 modified or untracked files.

## Validation

- 75 native tests passed, including matching after backspace correction, cursor movement, and replacing a selected typo.
- 231 web/API tests passed; TypeScript and the web production build passed.
- Version consistency and migration checks passed.
- 15 installer regression tests passed. The original installer reproduced a 0.2.67-to-0.2.54 downgrade in disposable fixtures; both updated entry points reject it without changing the existing app.
- Installer tests also cover same-version refusal, inconsistent version/build metadata, unreadable installed metadata, legacy bundle checks, signature failures, running-app refusal, and rollback after a failed final move.

## Runtime verification

Installed the signed 0.2.69 (2069) package through the guarded installer after the user quit Todo Trackr. The previous app was preserved as `Todo Trackr backup 20260919-184414-da90e65d.app`. Installed executable and Info.plist hashes match the packaged bundle. The reopened workspace loaded its tasks and exposed Shortcut ticket IDs in its accessibility tree.

Live verification remains incomplete: the UI automation tool became stuck reporting the View menu despite Escape. Interaction stopped under the shared-workstation safety rule. Refresh behavior, visual ID placement below link buttons, and snippet expansion with typo correction still need a live check. Automated tests and source parity do not substitute for this check.

Read-only installer preflight rejected both same-version 0.2.69 replacement and the actual signed 0.2.68 package against the installed 0.2.69 app without changing it.

## Installation safety

Use the [guarded installer](macos-installation.md). Manual copy commands and the preserved stale checkout's old installer do not gain this protection automatically. This release is packaged locally; publication requires separate authorization.
