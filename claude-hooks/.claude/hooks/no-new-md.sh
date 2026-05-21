#!/usr/bin/env bash
# PreToolUse on Write.
# Blocks creating new markdown files like SUMMARY.md, NOTES.md, IMPLEMENTATION.md
# that Claude likes to spawn uninvited. Sanctioned filenames are allowed.
# Edits to *existing* markdown files are unaffected.
set -euo pipefail

INPUT=$(cat)
tool=$(echo "$INPUT" | jq -r '.tool_name // ""')
# Only the Write tool creates new files; Edit/MultiEdit modify existing ones.
[ "$tool" != "Write" ] && exit 0

path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
[ -z "$path" ] && exit 0

case "$path" in
  *.md|*.markdown|*.MD|*.mdx) ;;
  *) exit 0 ;;
esac

# Allow sanctioned filenames (basename match).
case "$(basename "$path")" in
  README.md|README.mdx|CHANGELOG.md|CONTRIBUTING.md|LICENSE.md|CLAUDE.md|\
  SCOPE.md|LESSONS.md|CODE_OF_CONDUCT.md|SECURITY.md|.github/*)
    exit 0 ;;
esac

# If file already exists, this is an overwrite -- another hook can deal with it;
# we only block new-file creation here.
[ -f "$path" ] && exit 0

cat >&2 <<EOF
BLOCKED: creating new markdown file '$path' without explicit user request.

Claude tends to spam SUMMARY.md, NOTES.md, IMPLEMENTATION.md, NEXT_STEPS.md,
PLAN.md, etc. -- the user did not ask for these.

If the user genuinely asked for documentation:
  - Confirm the exact filename with them first
  - Or use a sanctioned name (README.md, CHANGELOG.md, etc.)

Otherwise, put your summary in the chat reply, not in a file.
EOF
exit 2
