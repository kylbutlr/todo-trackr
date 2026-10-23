# Build and install the macOS source

The public v1.0.0 release includes the Mac source, not a prebuilt binary. You do not need a paid Apple Developer membership to build it on your own Mac. You need Xcode with Swift 6.2 or later and a persistent local Code Signing certificate, as described in [the native setup steps](setup.md#install-the-macos-app). The resulting app connects to your selected Todo Trackr server. Source builds do not check for binary updates; pull a newer source release and rebuild.

Run `npm run install:macos` from a current checkout after quitting Todo Trackr yourself. The installer never quits an app. A stale checkout cannot overwrite a newer installed version through this command.

To install an already packaged and signed app without rebuilding:

```sh
bash scripts/install-macos.sh --bundle "/path/to/Todo Trackr.app"
```

An optional final argument selects the installation directory; the default is `~/Applications`. Both entry points use the same guard. For a read-only preflight:

```sh
python3 scripts/install-macos-bundle.py "/path/to/Todo Trackr.app" --check-only
```

The installer checks the application identifier, numeric version and build number, matching release numbering, and code signature before changing the destination. Both version and build must strictly increase. Same-version replacement, unreadable installed metadata, ad hoc signing, and a running Todo Trackr process are rejected. Existing `Todo Trackr.app` and legacy `Todo Tracker.app` copies in the destination are both checked.

The complete candidate is copied and verified in a staging directory before the existing app moves. A dated backup is retained in the installation directory. If the final move fails, the original is restored. No user preferences or app data are removed. The installer serializes its own runs with a lock directory; a stale lock requires inspection, not automatic deletion.

These safeguards apply to the supported installer. Finder replacement, `ditto`, or other manual copy commands bypass it and must not be used for installation. Always inspect the installed version before replacing it. A future prebuilt binary/Sparkle distribution would require its own signing, notarization, archive provenance, and appcast acceptance. It is outside the v1.0.0 source-only Mac distribution.

Run `npm run test:macos-install` to exercise downgrade prevention and failure recovery with disposable app fixtures. Tests never replace or quit an installed app.
