#!/usr/bin/env bash
# Promotes a numbered index file (browser-style duplicate names) to index.html,
# but only if its number is HIGHER than index.html's own tracked version.
# Matches: index(5).html, index (5).html, index5.html, index (5) copy.html, case insensitive
#
# index.html carries its own version as a marker comment on line 1:
#   <!-- BUILD_VERSION: 3 -->
# If that marker is missing, baseline is treated as 0.
#
# Usage:
#   bash promote-index.sh            # promote only; leftover numbered files stay on disk
#   bash promote-index.sh --clean    # promote, then delete the leftover numbered files
#                                     # (used by the CI workflow so the repo only ever
#                                     # carries index.html)
set -euo pipefail
shopt -s nullglob nocaseglob

clean=false
[ "${1:-}" = "--clean" ] && clean=true

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
declare -A seen=()
leftovers=()

# A single glob is enough here: "index*.html" already matches "index (5).html",
# "index5.html", "index (5) copy.html", etc., since spaces and parens aren't
# glob metacharacters. A second, near-identical pattern used to run alongside
# this one and double-match those files (once per pattern), which made the
# later `git rm`/`rm` step run twice on the same path, fail on the second try,
# and (under `set -e`) kill the whole promotion silently. The `seen` guard
# below is a belt-and-suspenders dedupe in case this glob is ever widened again.
for f in index*.html; do
  [ "$f" = "index.html" ] && continue
  [ -n "${seen[$f]:-}" ] && continue
  seen[$f]=1
  num=$(echo "$f" | grep -oE '[0-9]+' | head -1) || true
  [ -z "${num:-}" ] && continue
  leftovers+=("$f")
  if [ "$num" -gt "$best_num" ]; then
    best_num=$num
    best_file=$f
  fi
done

promoted=false
if [ -n "$best_file" ]; then
  echo "Promoting '$best_file' (version $best_num) over current version $baseline"
  { echo "<!-- BUILD_VERSION: $best_num -->"; cat "$best_file"; } > index.html.new
  mv index.html.new index.html
  promoted=true
else
  echo "Nothing beat version $baseline, index.html left as is"
fi

if $clean; then
  for f in "${leftovers[@]}"; do
    echo "Removing leftover file: $f"
    rm -f -- "$f"
  done
elif [ "${#leftovers[@]}" -gt 0 ]; then
  echo "Leftover numbered files still on disk: ${leftovers[*]}"
  echo "Run with --clean (or let the CI workflow do it) to remove them."
fi

# Machine-readable output for the GitHub Actions workflow; harmless locally
# since GITHUB_ENV won't be set outside CI.
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "PROMOTED=$promoted" >> "$GITHUB_ENV"
fi
