# Todo Trackr v1.1.1 verification

Verified November 7, 2026. This record describes the candidate acceptance checks.
The [GitHub release](https://github.com/kylbutlr/todo-trackr/releases/tag/v1.1.1)
is the authoritative publication and download location.

## Source and packages

The candidate includes labeled phone navigation, sticky Save/conflict feedback,
runtime dependency fixes, and clean development dependencies. The unused
`@trigger.dev/build` helper was removed after confirming no source imports;
the SDK and optional hosted integration remain unchanged. Vitest is updated
within v4, with a narrow sharp override. The final local pass completed 313 source tests, five standalone integration
tests, typecheck, migration/version/distribution-policy checks, both builds, and
a dependency audit with zero findings. Earlier 93 native source tests passed;
the required native workflow also runs on the release PR.

Source downloads support native-source verification without Git metadata using a
deterministic filesystem fallback. Existing checkout digests are preserved.
The earlier clean extracted-source installation, typecheck, and 310 tests passed;
the updated download is checked again after packaging the permission fix.

## Fresh Docker/PostgreSQL installation

The v1.1.1 source archive was extracted into an empty disposable directory and
built with the documented Compose inputs in an isolated Colima profile. The
rehearsal passed with real PostgreSQL 17:

- Unprivileged Node user, loopback-only port 8888, private database port, and
  disabled integration defaults.
- Task creation, conflicting simultaneous edits returning 200/409, deletion,
  restoration, and JSON export.
- PostgreSQL dump restored into a separate database with the expected task.
- Tasks and due attention alarms retained after restart; migrations rerun safely.
- Explicit passwordless mode, switching to protected mode, unauthorized API
  rejection, wrong-password rejection, and authenticated access.

The first-run extension correction changes extension files only. The container
inputs that passed this rehearsal are unchanged by that correction.

## Installed Quick Capture

The first native run exposed a real lifecycle bug: Chrome's optional host-access
sheet closes the popup, losing the unfinished setup. The fix records the intended
origin before requesting permission and resumes setup only after checking the
actual grant. Regression tests reproduce popup destruction, denied access, and
credential clearing when changing servers.

The corrected v1.1.1 ZIP was installed into a fresh, disposable Google Chrome for
Testing profile. With the actual toolbar popup and native permission sheet:

- Approved access to only the disposable loopback server.
- Reopened the popup and verified automatic recovery into the connected state,
  without entering the origin or selecting Connect again.
- Captured a fictional ordinary page through the real toolbar action. The server
  received the expected page title and source URL, and the popup showed success.
- Verified Chrome registered a capture notification, then disconnected and
  confirmed connection/credential storage was empty.

No permission API or capture result was stubbed during installed acceptance.
The fictional webpage was served through a route fixture; the server and database
were real disposable application runtimes. Earlier installed checks also covered
invalid server origins and empty first-run storage.

## Evidence limits

This does not establish a physical device showing a notification, real phone
software-keyboard behavior, installed password-mode extension login, or an
installed Mac binary. Those are separate device/client checks, not claimed
passes. Server authentication modes and extension credential handling have
separate automated coverage. Mac distribution remains source only; no native
binary or update feed is introduced or replaced.

## Cleanup and publication

The rehearsal removed only its random Compose project's containers, network, and
volumes. The task-owned VM was stopped. Both browser profiles were removed and
both disposable preview servers exited; port 8888 was checked closed. Personal
browser profiles, databases, installed apps, and credentials were untouched.

Publish only new immutable v1.1.1 assets after exact-head CI passes and the release
contents match their recorded checksums. Do not replace v1.1.0 downloads.
