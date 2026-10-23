#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd "$(dirname "$0")" && pwd)"
repository_root="$(cd "$script_directory/.." && pwd)"

if [[ "${1:-}" == "--bundle" ]]; then
    if [[ $# -lt 2 || $# -gt 3 ]]; then
        echo "Usage: $0 --bundle SIGNED_APP [INSTALL_DIRECTORY]" >&2
        exit 64
    fi
    application_bundle="$2"
    install_directory="${3:-$HOME/Applications}"
else
    if [[ $# -gt 1 ]]; then
        echo "Usage: $0 [INSTALL_DIRECTORY] | --bundle SIGNED_APP [INSTALL_DIRECTORY]" >&2
        exit 64
    fi
    install_directory="${1:-$HOME/Applications}"
    staging_directory="$(mktemp -d "${TMPDIR:-/tmp}/todo-tracker-install.XXXXXX")"
    trap 'rm -rf "$staging_directory"' EXIT
    application_bundle="$($repository_root/scripts/build-macos-app.sh "$staging_directory")"
fi

python3 "$script_directory/install-macos-bundle.py" "$application_bundle" "$install_directory"
