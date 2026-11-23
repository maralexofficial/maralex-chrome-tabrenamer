#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/manifest.json"
DIST_DIR="$ROOT_DIR/dist"

if ! command -v zip >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
  echo "Both zip and unzip are required to package TabRenamer." >&2
  exit 1
fi

VERSION="$(node -e 'const fs=require("node:fs"); const manifest=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if (!/^\\d+\\.\\d+\\.\\d+$/.test(manifest.version)) process.exit(1); process.stdout.write(manifest.version);' "$MANIFEST")"
ARCHIVE="$DIST_DIR/tabrenamer-v$VERSION.zip"
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

mkdir -p "$DIST_DIR"
cp "$MANIFEST" "$STAGING_DIR/manifest.json"
cp -R "$ROOT_DIR/src" "$STAGING_DIR/src"
cp -R "$ROOT_DIR/icons" "$STAGING_DIR/icons"

rm -f "$ARCHIVE"
(
  cd "$STAGING_DIR"
  zip -qr "$ARCHIVE" manifest.json src icons
)

unzip -tq "$ARCHIVE" >/dev/null
echo "Created and verified: $ARCHIVE"
