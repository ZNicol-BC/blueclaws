#!/usr/bin/env bash
# Promotes a newly uploaded HTML file to index.html.
#
# The upload flow is: someone drops a new build into the repo root as any
# *.html file other than index.html — the name doesn't matter ("index (12).html",
# "site-v2.html", "newbuild.html", whatever the browser/tool happened to save it
# as. Only one such file is ever present at a time, so there's no version number
# to parse out of a filename: whatever new .html file shows up is, by
# construction, the newest one, and it replaces index.html.
#
# Usage:
#   bash promoteindex.sh            # promote only; leftover file stays on disk
#   bash promoteindex.sh --clean    # promote, then delete the leftover file(s)
#   bash promoteindex.sh --check    # report only; change nothing (exit 0/1)

set -euo pipefail
shopt -s nullglob nocaseglob

clean=false
check_only=false
case "${1:-}" in
  --clean) clean=true ;;
  --check) check_only=true ;;
  "") ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac

die() { echo "ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Every .html file in the repo root except index.html itself is a candidate.
# nocaseglob + a single *.html pattern is enough — bash glob matching is
# already case-insensitive here, so we don't need separate *.HTML patterns.
# ---------------------------------------------------------------------------
candidates=()
for f in *.html; do
  [ "${f,,}" = "index.html" ] && continue
  candidates+=("$f")
done

if [ "${#candidates[@]}" -eq 0 ]; then
  if $check_only; then echo "Nothing to promote."; exit 0; fi
  echo "No new HTML file found; index.html left as is."
  [ -f index.html ] || die "index.html does not exist and there is nothing to promote it from."
  exit 0
fi

# ---------------------------------------------------------------------------
# Only one file is ever expected on disk at a time. If more than one somehow
# shows up, mtime is the only signal left for "newest added" once there's no
# version number in the filename — so the most recently modified file wins.
# ---------------------------------------------------------------------------
best_file=$(stat -c '%Y %n' -- "${candidates[@]}" | sort -rn | head -1 | cut -d' ' -f2-)
leftovers=("${candidates[@]}")

if $check_only; then
  echo "Would promote '$best_file'"
  [ "${#candidates[@]}" -gt 1 ] && echo "Note: ${#candidates[@]} candidate files found; picking newest by mtime."
  exit 1
fi

echo "Promoting '$best_file' to index.html"
[ -s "$best_file" ] || die "'$best_file' is empty — refusing to promote it over a working site."
grep -qi '<html' "$best_file" || die "'$best_file' has no <html> tag — refusing to promote it."

cp -- "$best_file" index.html.new

# Never publish something obviously broken.
[ -s index.html.new ] || die "Generated index.html is empty — aborting."
grep -qi '<html' index.html.new || die "Generated index.html has no <html> tag — aborting."

mv index.html.new index.html
promoted=true

# ---------------------------------------------------------------------------
# THE GUARANTEE THIS SCRIPT EXISTS TO PROVIDE.
#
# The site went down once because index.html stopped existing and nothing
# noticed. From here, no exit path leaves the repo without an index.html.
# ---------------------------------------------------------------------------
[ -f index.html ] || die "index.html does not exist after promotion. Refusing to finish — the site would 404."

if $clean; then
  for f in "${leftovers[@]}"; do
    # Only ever remove a leftover once index.html is confirmed present.
    echo "Removing leftover file: $f"
    rm -f -- "$f"
  done
elif [ "${#leftovers[@]}" -gt 0 ]; then
  echo "Leftover file(s) still on disk: ${leftovers[*]}"
  echo "Run with --clean (or let the CI workflow do it) to remove them."
fi

echo "OK: index.html present, $(wc -c < index.html) bytes"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "PROMOTED=$promoted" >> "$GITHUB_ENV"
fi
