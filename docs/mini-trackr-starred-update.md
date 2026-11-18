# Mini Trackr favorite rendering candidate

On October 26, 2026, the installed 0.2.89 app showed two outline stars in Mini Trackr with the Starred-only filter enabled. Reapplying the filter retained both rows. The main workspace reported the same Tasks as starred, with “Remove from Starred” controls. No Task favorite values were changed during inspection.

The patch adds `isStarred` to `TaskItem.presentationIdentity`, the existing explicit invalidation key used by Mini Trackr Task rows. A favorite change now changes that key, as due-date, alarm, and workflow changes already do. Unchanged favorites retain the same key even when `updatedAt` changes. There are no API, polling, synchronization, alarm, sorting, or persistence changes.

## Verification and limits

- The new snapshot-merge/timeline tests failed before the patch on four identity-change assertions: starring and unstarring dated and undated Shortcut-backed Tasks. The filter and favorite-value assertions already passed.
- All 93 native tests passed on the main-based feature branch after the patch.
- A synthetic native render fixture handled filter toggles and favorite refreshes correctly before the patch. It did not reproduce the long-lived installed panel's stale rendering. Its passing result is not end-to-end proof of this fix.
- Installed-native verification remains pending. With both native surfaces open, change a favorite in the main workspace, check the Mini Trackr icon, reapply Starred-only filtering, then unstar and confirm removal. Include dated and undated Tasks. Preserve the original favorite settings.

## Separate legacy updater candidate

The public v1.0.0 distribution remains source-only under [release.json](../release.json). This PR does not change that policy or any signed update asset. A separate, unpublished local candidate was prepared for the existing 0.2.89 updater:

- Version 0.2.90, build 2090, arm64, macOS 14 minimum.
- Baseline `1f63acbf3b2cbe9d585d39a2e17a809426ae9e28`. Its native source digest exactly matches the distributed 0.2.89 provenance: `b0f4bcd0f485266c641c6646f2da1d69057d6f8de2c76c8316f27a2527e4c4b5`.
- Only the favorite identity change, its tests, and the native version/build metadata differ from that baseline. The v1.0.0 client changes are not included.
- All 88 tests passed against this backported native source.
- The release bundle and extracted ZIP pass deep, strict code-signature verification. The designated signing requirement matches the installed app. The read-only installer preflight passes against `/Applications` 0.2.89.
- The candidate archive and generated appcast verify independently against the installed Sparkle public key. The existing feed URL, signing key, automatic-update settings, and older update entries are retained.
- Archive SHA-256: `ee6b5f79dcdafdc980e5d60badfd0f0d4913782f06eb055f71495affa91e3cfc`.
- Candidate native source digest: `b7b5689be8656aa8820b95065170591b3517825bd10bd618ea9a287d638c46f0`.

This is a persistent locally signed legacy candidate, not a Developer ID-signed or notarized public Mac distribution. The local candidate directory retains the source snapshot, provenance, signed archive, signed feed, and verification logs. No app was installed, launched, quit, or replaced during preparation. No feed or archive was published.

## Remaining gates and rollback

Review the source PR and verify the candidate's native behavior before publication. Installing a candidate requires separate approval and the user must first quit Todo Trackr. Use the guarded installer described in [macOS installation](macos-installation.md); do not bypass its running-app or downgrade checks.

Publishing to the existing updater would require a deliberate legacy distribution decision, separate authorization, and preservation of the current public source-only policy. The current notarized-release command is not a legacy publishing command. No release guard was weakened to prepare these local artifacts.

Before publication, rollback is simply to leave the public feed and installed app unchanged. If the source patch is merged and needs reverting, revert its code change. After a native publication, use a higher version/build to restore the previous behavior; the guarded installer deliberately refuses downgrades. Preserve the prior signed archive and feed as evidence.
