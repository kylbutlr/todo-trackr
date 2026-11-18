#!/usr/bin/env bash
set -euo pipefail
script_directory="$(cd "$(dirname "$0")" && pwd)"
cd "$script_directory/.."
node scripts/sync-app-stylr.mjs
