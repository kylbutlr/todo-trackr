#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 VERSION" >&2
    echo "Example: $0 1.0.0" >&2
    exit 64
fi

version="$1"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "VERSION must use major.minor.patch format." >&2
    exit 64
fi

IFS=. read -r major minor patch <<< "$version"
if (( major > 999 || minor > 999 || patch > 999 )); then
    echo "Each version component must be between 0 and 999." >&2
    exit 64
fi

build_number=$((10#$major * 1000000 + 10#$minor * 1000 + 10#$patch))

script_directory="$(cd "$(dirname "$0")" && pwd)"
repository_root="$(cd "$script_directory/.." && pwd)"
distribution="$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).distribution.macos" "$repository_root/release.json")"
if [[ "$distribution" != "notarized" ]]; then
    echo "This release distributes macOS source only. No binary update needs to be generated." >&2
    exit 1
fi
if [[ "${TODO_TRACKR_CODESIGN_IDENTITY:-}" != "Developer ID Application: "* ]]; then
    echo "A distributed binary requires TODO_TRACKR_CODESIGN_IDENTITY to name a Developer ID Application identity." >&2
    echo "Source-only GitHub releases do not require this command or an Apple membership." >&2
    exit 1
fi
updates_directory="$repository_root/apps/web/public/updates"
archive_name="Todo-Trackr-$version.zip"
archive_path="$updates_directory/$archive_name"
archive_repository_path="apps/web/public/updates/$archive_name"
provenance_name="Todo-Trackr-$version.source.json"
provenance_path="$updates_directory/$provenance_name"

if git -C "$repository_root" cat-file -e "HEAD:$archive_repository_path" 2>/dev/null; then
    echo "Version $version has already been committed. Choose a newer version." >&2
    exit 1
fi

staging_directory="$(mktemp -d "${TMPDIR:-/tmp}/todo-trackr-release.XXXXXX")"
trap 'rm -rf "$staging_directory"' EXIT

TODO_TRACKR_VERSION="$version" \
TODO_TRACKR_BUILD="$build_number" \
TODO_TRACKR_DISTRIBUTION=notarized \
    "$script_directory/build-macos-app.sh" "$staging_directory"

mkdir -p "$updates_directory"
ditto -c -k --sequesterRsrc --keepParent \
    "$staging_directory/Todo Trackr.app" \
    "$archive_path"

node "$script_directory/macos-source-digest.mjs" --json "$version" "$build_number" \
    > "$provenance_path"

sparkle_tools="$repository_root/apps/macos/.build/artifacts/sparkle/Sparkle/bin"
if [[ ! -x "$sparkle_tools/generate_appcast" ]]; then
    echo "Sparkle signing tools are missing. Run swift package resolve first." >&2
    exit 1
fi

# Public feeds contain only assets belonging to this GitHub release. Retain
# older private archives locally without assigning them the new release URL.
feed_directory="$updates_directory"
if (( major >= 1 )); then
    feed_directory="$staging_directory/public-feed"
    mkdir -p "$feed_directory"
    cp "$archive_path" "$feed_directory/$archive_name"
fi

"$sparkle_tools/generate_appcast" \
    --account com.kylbutlr.todotracker \
    --download-url-prefix "https://github.com/kylbutlr/todo-trackr/releases/download/v$version/" \
    --link "https://github.com/kylbutlr/todo-trackr" \
    --maximum-versions 3 \
    --maximum-deltas 0 \
    "$feed_directory"

if [[ "$feed_directory" != "$updates_directory" ]]; then
    cp "$feed_directory/appcast.xml" "$updates_directory/appcast.xml"
fi

echo "Prepared Todo Trackr $version (build $build_number) as a local GitHub release candidate."
echo "Archive: $archive_path"
echo "Source provenance: $provenance_path"
echo "Feed: $updates_directory/appcast.xml"
echo "Public distribution still requires Developer ID signing, notarization, and approved publication of v$version assets."
