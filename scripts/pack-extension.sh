#!/usr/bin/env bash
#
# pack-extension.sh — bundle extension/ into a zip ready for the
# Chrome Web Store developer console.
#
# Usage:   ./scripts/pack-extension.sh
# Output:  releases/peanut-gallery-v<version>.zip
#

set -euo pipefail

# Resolve repo root (directory that contains this script's parent)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXT_DIR="$REPO_ROOT/extension"
OUT_DIR="$REPO_ROOT/releases"

if [[ ! -d "$EXT_DIR" ]]; then
  echo "✗ extension/ directory not found at $EXT_DIR"
  exit 1
fi

# Pull version from manifest.json — CWS rejects uploads where the zip's
# manifest version is <= the currently-published version, so stamp the
# filename with it for sanity.
VERSION="$(
  node -e "process.stdout.write(require('./extension/manifest.json').version)" \
    2>/dev/null \
  || grep -E '"version":' "$EXT_DIR/manifest.json" \
     | head -1 | sed -E 's/.*"version":[[:space:]]*"([^"]+)".*/\1/'
)"

if [[ -z "${VERSION:-}" ]]; then
  echo "✗ could not read version from extension/manifest.json"
  exit 1
fi

mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/peanut-gallery-v${VERSION}.zip"
rm -f "$OUT_FILE"

# Zip from inside extension/ so manifest.json sits at the root of the archive
# (Chrome Web Store requires manifest.json at the top level).
cd "$EXT_DIR"

# Exclude OS/editor cruft and any local-only files.
zip -r -9 "$OUT_FILE" . \
  -x "*.DS_Store" \
  -x "__MACOSX*" \
  -x "*.swp" \
  -x ".git*" \
  -x "node_modules/*" \
  > /dev/null

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "✓ packed extension v${VERSION} → ${OUT_FILE} (${SIZE})"
echo
echo "Next: upload this zip at https://chrome.google.com/webstore/devconsole"
