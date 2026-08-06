#!/usr/bin/env bash
# Promotes a numbered index file (browser-style duplicate names) to index.html,
# but only if its version is HIGHER than index.html's own tracked version.
#
# Matches: index5.html, index (5).html, index_5.html, index 5.html,
#          index244 (1).html, index234 (2) (1).html, Index151 (3).html
# Ignores: index.html, index.html.html, and bare browser duplicates of
#          index.html itself — "index (1).html" is a copy of index.html, not
#          version 1. Promoting those was a live footgun: with index.html
#          missing, "index (1).html" scored version 1 and became the site.
#
# index.html carries its own version as a marker comment on line 1:
#   <!-- BUILD_VERSION: 244 -->
#
# Usage:
#   bash promote-index.sh            # promote only; leftovers stay on disk
#   bash promote-index.sh --clean    # promote, then delete the leftovers
#   bash promote-index.sh --check    # report only; change nothing (exit 0/1)

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
# Version of the file we already serve.
#
# Reads the HIGHEST marker in the file, not the first. index.html had TWELVE
# stacked "<!-- BUILD_VERSION: 241 -->" lines, because every promotion prepended
# a new marker and none ever removed the old ones — and a downloaded, re-uploaded
# index.html carried the whole pile back in. `head -1` on that stack can report a
# version far below what the file actually contains, which lets an OLDER build
# win the comparison and overwrite a newer one.
# ---------------------------------------------------------------------------
baseline=0
if [ -f index.html ]; then
  highest=$(grep -oE '<!-- *BUILD_VERSION: *[0-9]+ *-->' index.html \
            | grep -oE '[0-9]+' | sort -n | tail -1 || true)
  [ -n "${highest:-}" ] && baseline=$highest
fi
echo "Current index.html version: $baseline"

# ---------------------------------------------------------------------------
# Pick the version out of a filename.
#
# The number that matters is the one attached to "index", not whichever digit
# appears first. A trailing "(1)" is a browser duplicate marker and never a
# version. Prints nothing when the name carries no real version.
# ---------------------------------------------------------------------------
version_of() {
  local name="$1" stem
  stem=${name%.[Hh][Tt][Mm][Ll]}                 # drop the extension
  stem=$(printf '%s' "$stem" | sed -E 's/[[:space:]]*\([0-9]+\)[[:space:]]*$//g; s/[[:space:]]*\([0-9]+\)[[:space:]]*\([0-9]+\)[[:space:]]*$//g')
  # Repeat once more so "index234 (2) (1)" loses both duplicate markers.
  stem=$(printf '%s' "$stem" | sed -E 's/[[:space:]]*\([0-9]+\)[[:space:]]*$//g')
  # What remains must be index<sep><digits> — nothing else counts.
  printf '%s' "$stem" | sed -nE 's/^[Ii][Nn][Dd][Ee][Xx][ _-]*([0-9]+)$/\1/p'
}

best_num=$baseline
best_file=""
declare -A seen=()
leftovers=()

for f in index*.html; do
  [ "${f,,}" = "index.html" ] && continue
  [ -n "${seen[$f]:-}" ] && continue
  seen[$f]=1
  num=$(version_of "$f")
  if [ -z "$num" ]; then
    echo "Skipping '$f' — no version in the name (not a numbered build)"
    continue
  fi
  leftovers+=("$f")
  if [ "$num" -gt "$best_num" ]; then
    best_num=$num
    best_file=$f
  fi
done

if $check_only; then
  if [ -n "$best_file" ]; then
    echo "Would promote '$best_file' (version $best_num) over $baseline"; exit 1
  fi
  echo "Nothing to promote."; exit 0
fi

promoted=false
if [ -n "$best_file" ]; then
  echo "Promoting '$best_file' (version $best_num) over current version $baseline"
  [ -s "$best_file" ] || die "'$best_file' is empty — refusing to promote it over a working site."

  # Strip every leading BUILD_VERSION marker from the source before adding ours,
  # so the markers stop stacking and the doctype stays near the top of the file.
  {
    echo "<!-- BUILD_VERSION: $best_num -->"
    sed -E '1,64{/^[[:space:]]*<!-- *BUILD_VERSION: *[0-9]+ *-->[[:space:]]*$/d}' "$best_file"
  } > index.html.new

  # Never publish something obviously broken.
  [ -s index.html.new ] || die "Generated index.html is empty — aborting."
  grep -qi '<html' index.html.new || die "Generated index.html has no <html> tag — aborting."

  mv index.html.new index.html
  promoted=true
else
  echo "Nothing beat version $baseline, index.html left as is"
fi

# ---------------------------------------------------------------------------
# THE GUARANTEE THIS SCRIPT EXISTS TO PROVIDE.
#
# The site went down because index.html stopped existing and nothing noticed —
# two promotion runs failed, index.html had been deleted by hand, and the next
# deploy published a repo with no index.html at all. Netlify served 404s and
# every check upstream was green.
#
# From here, no exit path leaves the repo without an index.html.
# ---------------------------------------------------------------------------
[ -f index.html ] || die "index.html does not exist and nothing could be promoted to create it. Refusing to finish — the site would 404. Upload a numbered index file (index<N>.html) and run again."

if $clean; then
  for f in "${leftovers[@]}"; do
    # Only ever remove a leftover once index.html is confirmed present.
    echo "Removing leftover file: $f"
    rm -f -- "$f"
  done
elif [ "${#leftovers[@]}" -gt 0 ]; then
  echo "Leftover numbered files still on disk: ${leftovers[*]}"
  echo "Run with --clean (or let the CI workflow do it) to remove them."
fi

echo "OK: index.html present, version $best_num, $(wc -c < index.html) bytes"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "PROMOTED=$promoted" >> "$GITHUB_ENV"
  echo "BUILD_NUM=$best_num" >> "$GITHUB_ENV"
fi
