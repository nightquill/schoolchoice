#!/usr/bin/env bash
# PreToolUse on Write|Edit|MultiEdit.
# Blocks edits to files outside the declared task scope.
# Define scope in .claude/SCOPE (one glob per line, e.g. `src/auth/**`).
# Empty or missing SCOPE file = no restriction (so safe to leave installed).
#
# This is the structural fix for "always changes things I didn't ask for".
set -euo pipefail

INPUT=$(cat)
path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
[ -z "$path" ] && exit 0

scope_file=".claude/SCOPE"
[ ! -f "$scope_file" ] && exit 0
[ ! -s "$scope_file" ] && exit 0

# Always permit edits to SCOPE itself and LESSONS.md (meta-files).
case "$path" in
  .claude/SCOPE|./.claude/SCOPE|.claude/LESSONS.md|./.claude/LESSONS.md) exit 0 ;;
esac

normalized="${path#./}"

while IFS= read -r pattern || [ -n "$pattern" ]; do
  [ -z "$pattern" ] && continue
  case "$pattern" in \#*) continue ;; esac
  # Enable globstar for ** patterns
  shopt -s globstar extglob nullglob 2>/dev/null || true
  case "$normalized" in
    $pattern) exit 0 ;;
  esac
done < "$scope_file"

cat >&2 <<EOF
BLOCKED: edit to '$path' is outside the declared scope.

Current scope (.claude/SCOPE):
$(sed 's/^/  /' .claude/SCOPE)

If this edit is genuinely required:
  - Ask the user to expand .claude/SCOPE, OR
  - Explain WHY and wait for approval.
Do not proceed silently or pick a different file to edit.
EOF
exit 2
