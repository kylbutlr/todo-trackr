#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "$0")" && pwd)"
repository_root="$(cd "$script_directory/.." && pwd)"
public_directory="$repository_root/apps/web/public"
icons_directory="$public_directory/icons"
extension_icons_directory="$repository_root/apps/browser-extension/icons"
working_directory="$(mktemp -d "${TMPDIR:-/tmp}/todo-tracker-web-icons.XXXXXX")"
trap 'rm -rf "$working_directory"' EXIT

mkdir -p "$icons_directory" "$extension_icons_directory"
swift "$script_directory/render-macos-icon.swift" "$working_directory/todo-tracker-master.png"
sips -z 180 180 "$working_directory/todo-tracker-master.png" --out "$public_directory/apple-touch-icon.png" >/dev/null
sips -z 192 192 "$working_directory/todo-tracker-master.png" --out "$icons_directory/todo-tracker-192.png" >/dev/null
sips -z 512 512 "$working_directory/todo-tracker-master.png" --out "$icons_directory/todo-tracker-512.png" >/dev/null
sips -z 16 16 "$working_directory/todo-tracker-master.png" --out "$extension_icons_directory/icon-16.png" >/dev/null
sips -z 32 32 "$working_directory/todo-tracker-master.png" --out "$extension_icons_directory/icon-32.png" >/dev/null
sips -z 48 48 "$working_directory/todo-tracker-master.png" --out "$extension_icons_directory/icon-48.png" >/dev/null
sips -z 128 128 "$working_directory/todo-tracker-master.png" --out "$extension_icons_directory/icon-128.png" >/dev/null

echo "Generated Todo Trackr web app and browser extension icons."
