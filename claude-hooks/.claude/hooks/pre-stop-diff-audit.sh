#!/usr/bin/env bash
# Stop hook.
# Before the session ends, list any modified files that fall OUTSIDE .claude/SCOPE
# and block stop until Claude justifies or reverts them. The second wall against
# unrequested changes -- catches anything scope-guard missed.
set -euo pipefail

INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then exit 0; fi
command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

changed=$( (git diff --name-only 2>/dev/null; \
            git diff --name-only --cached 2>/dev/null; \
            git ls-files --others --exclude-standard 2>/dev/null) \
          | sort -u | grep -v '^$' || true)
[ -z "$changed" ] && exit 0

scope_file=".claude/SCOPE"
if [ ! -f "$scope_file" ] || [ ! -s "$scope_file" ]; then
  # No scope declared -- just print the diff summary for review and exit.
  echo "Session about to end. Files changed:" >&2
  echo "$changed" | sed 's/^/  /' >&2
  echo "" >&2
  echo "Confirm each maps to what the user asked for." >&2
  exit 0
fi

out_of_scope=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  matched=false
  while IFS= read -r pattern || [ -n "$pattern" ]; do
    [ -z "$pattern" ] && continue
    case "$pattern" in \#*) continue ;; esac
    shopt -s globstar extglob nullglob 2>/dev/null || true
    case "$file" in $pattern) matched=true; break ;; esac
  done < "$scope_file"
  [ "$matched" = false ] && out_of_scope="${out_of_scope}  $file\n"
done <<< "$changed"

if [ -n "$out_of_scope" ]; then
  cat >&2 <<EOF
Before finishing: these modified files are OUTSIDE the declared scope:

$(printf "%b" "$out_of_scope")
For EACH one:
  - Justify why it was necessary, AND tell the user explicitly, OR
  - Revert it:  git checkout -- <file>   (or: rm <file> if untracked)

Do not finish silently.
EOF
  exit 2
fi
exit 0
