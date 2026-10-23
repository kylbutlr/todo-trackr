# Automatic Shortcut sync on this Mac

Click the **Next sync** countdown in Mini Trackr's fixed bottom footer, or the clock icon in the main window toolbar. The footer stays outside the scrolling task list, with an opaque background and separator. Pinned timeline headings are also opaque so rows cannot show through them while scrolling. Choose **Off**, **1**, **5**, **15**, **30**, or **60 minutes**. The default for new installations is **60 minutes**. Previously saved choices are preserved. The preference is saved on this Mac, shared by both windows, and does not change the server's Connection mode or repair schedule.

This timer fetches fresh Shortcut data through the authenticated sync API, then reloads open Tasks and the Shortcut Board if it has been opened. Ordinary Task refresh backs off to ten minutes when snapshots stay unchanged. The server only applies Shortcut changes when the Connection is Automatic; Review and Off are respected. An ignored sync is shown as a Connection-mode notice rather than a successful sync.

The countdown uses the scheduler's actual next-attempt date. Manual sync resets it after completion. Both windows and manual requests share one in-flight Shortcut request. Failures retain their own error message and wait a full interval before retrying; successful Task reads do not erase that error. The last-success time describes the Shortcut fetch, not network connectivity generally.

No scheduled API calls run while both Task windows are hidden or minimized, or while signed out. The local timer does not query the database to decide whether work is due. An overdue sync runs once after a Task surface is visible again; it does not replay missed intervals. macOS sleep or network latency can delay a sync. Changing the interval starts a new countdown immediately; Off stops future attempts but does not cancel an already submitted request.

Short intervals increase database and Shortcut API usage. They are an explicit per-device choice, not a replacement for working webhooks. Webhooks and the server's six-hour repair remain unchanged. Running multiple Macs with this option enabled creates independent polling on each Mac.

## Verification

Run `swift test` from `apps/macos`. Schedule tests cover due times, preference persistence, interval changes, Off/manual behavior, hidden and signed-out states, one catch-up after sleep, retry timing, ignored results, countdown accuracy, and overlap between manual and automatic sync.

Set `TODO_TRACKR_SYNC_PREVIEW_DIRECTORY` to an existing temporary directory to render the actual settings view with fixture data during the tests. This does not install or launch Todo Trackr or use production credentials.

Before live signoff, verify an actual Shortcut change appears after the countdown without pressing Refresh, minimize both windows to verify suspension, and reopen to verify catch-up. These checks require the installed new build and a Connection in Automatic mode. Local test/render results do not establish production webhook delivery.

## Local validation, September 20, 2026

- Started from freshly fetched `origin/main` at `8777dfc` in an isolated worktree. The original checkout was not modified or incorporated.
- All 82 native tests passed, including existing Text Snippets and window/refresh regression tests. The seven focused schedule/render tests also passed after final changes.
- All 15 guarded-installer tests passed using temporary fixture apps only. Product version consistency and whitespace checks passed.
- Inspected offscreen native renders of the settings, including default, short-interval warning, failure/retry, ignored-connection, and Off states. These verify layout, not live menu interaction or production sync. The App Stylr reference and style-guide URLs both redirected to the same reference landing page; the pinned tokens were preserved.
- At the initial packaging checkpoint, installed-app interaction and end-to-end Shortcut updates were pending.

## Mini Trackr scroll fix, 0.2.71

- The approved 0.2.70 installation was completed separately. Its countdown and interval popover were subsequently verified in the installed app. End-to-end verification with a deliberately changed Shortcut Story remains pending.
- Reproduced the Mini Trackr scroll defect in the installed 0.2.70 app: a Task row remained visible behind the pinned timeline heading. The heading used the transparent canvas appearance intended for window backgrounds.
- Changed pinned Mini Trackr headings to the opaque canvas token and moved sync controls into a fixed, opaque footer outside the clipped content area. The same footer applies to Tasks and Shortcut mode. Quick Add remains above it; signed-out/checking views do not show the footer.
- Added a rendering regression test that failed before the fix and passed afterward: a pinned heading must render identically over red and blue underlying content.
- All 84 native tests passed. Inspected native fixture renders at widths of 340 and 480 points, with initial and scrolled timeline states. These use production heading/footer components with synthetic rows, not the complete installed panel. The layout detector reported no findings.
- The signed 0.2.71 build was installed with approval, preserving 0.2.70 as an application backup. Verified the running bundle version, real Mini Trackr Tasks scrolling, opaque pinned headings, the fixed bottom countdown, and Quick Add expanding above the footer without overlap. The sync settings popover was observed open at a one-minute interval, which was left unchanged. The countdown subsequently entered "Syncing Shortcut". This does not establish reconciliation of a deliberately changed Story or completion of that request. Shortcut-mode installed scrolling remains untested; it shares the same footer and heading components. No push or publication was performed.
