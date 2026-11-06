# Existing Mac updater compatibility

The public release's macOS distribution remains source-only. These files preserve an already-published, locally signed legacy update for existing 0.2.x installations. They do not enable Sparkle in new source builds, create a new native release, or claim Developer ID signing or notarization.

Version 0.2.90, build 2090, was published on October 26, 2026. Its original signed feed and archive are retained byte-for-byte under `0.2.90`, with their source-provenance JSON and SHA-256 manifest. The feed was previously carried as an external static overlay, which a later normal web deployment omitted.

The web workspace's postbuild runs `scripts/restore-legacy-macos-feed.mjs`. It verifies all hashes and the feed/archive Ed25519 signatures before copying these three files into the built `updates` directory. In a Netlify production build, it also reads the current public feed and refuses to replace a newer advertised build. An unreadable feed stops deployment rather than guessing.

For a future legacy publication, deliberately update this verified overlay, its manifest and compatibility tests together. Do not bypass the newer-build check. New public Mac binary distribution remains a separate decision governed by the release configuration and signing/notarization workflow.
