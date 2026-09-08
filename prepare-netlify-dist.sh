#!/usr/bin/env bash
# Build the tiny public folder Netlify should serve.
# Keeping production out of the repo root prevents local diagnostics, scripts,
# and recovery files from becoming public assets.

set -euo pipefail

rm -rf dist
mkdir -p dist

cp BlueClawsIQ.html dist/BlueClawsIQ.html
cp index.html dist/index.html

if [ -f robots.txt ]; then
  cp robots.txt dist/robots.txt
fi

[ -s dist/index.html ] || { echo "dist/index.html is missing or empty" >&2; exit 1; }
[ -s dist/BlueClawsIQ.html ] || { echo "dist/BlueClawsIQ.html is missing or empty" >&2; exit 1; }
cmp -s dist/index.html dist/BlueClawsIQ.html || { echo "dist copies do not match" >&2; exit 1; }

echo "OK: prepared dist with $(wc -c < dist/index.html) byte app"
