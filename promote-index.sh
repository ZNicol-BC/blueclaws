#!/usr/bin/env bash
# Promotes a numbered index file (browser style duplicate names) to index.html,
# but only if its number is HIGHER than index.html's own tracked version.
# Matches: index(5).html, index (5).html, index5.html, index (5) copy.html, case insensitive
#
# index.html carries its own version as a marker comment on line 1:
#   <!-- BUILD_VERSION: 3 -->
# If that marker is missing, baseline is treated as 0.
set -euo pipefail

shopt -s nullglob nocaseglob

baseline=0
if [ -f index.html ]; then
  marker=$(grep -oE '<!-- *BUILD_VERSION: *[0-9]+ *-->' index.html | head -1 || true)
  if [ -n "$marker" ]; then
    baseline=$(echo "$marker" | grep -oE '[0-9]+')
  fi
fi
echo "Current index.html version: $baseline"

best_num=$baseline
best_file=""

for f in index*.html "index (*"*.html; do
  [ "$f" = "index.html" ] && continue
  num=$(echo "$f" | grep -oE '[0-9]+' | head -1) || true
  if [ -n "${num:-}" ] && [ "$num" -gt "$best_num" ]; then
    best_num=$num
    best_file=$f
  fi
done

if [ -n "$best_file" ]; then
  echo "Promoting '$best_file' (version $best_num) over current version $baseline"
  { echo "<!-- BUILD_VERSION: $best_num -->"; cat "$best_file"; } > index.html.new
  mv index.html.new index.html
else
  echo "Nothing beat version $baseline, index.html left as is"
fi

echo "Leftover numbered files still exist in git and must be deleted from GitHub manually, this script cannot do that for you."
