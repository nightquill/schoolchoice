#!/usr/bin/env bash
# SessionStart hook.
# Loads .claude/LESSONS.md into Claude's context at every session start so that
# previously-learned lessons survive session boundaries. This is the structural
# fix for "bugs come back" -- the model has no memory, but the file does.
#
# stdout of SessionStart hooks is added to Claude's context.
set -euo pipefail

[ ! -f .claude/LESSONS.md ] && exit 0
[ ! -s .claude/LESSONS.md ] && exit 0

cat <<'HEADER'
=== Past lessons learned for this project (from .claude/LESSONS.md) ===
The following are bugs, gotchas, and patterns documented from previous
sessions. READ AND APPLY THEM. Do not repeat mistakes documented here.
HEADER

cat .claude/LESSONS.md

cat <<'FOOTER'
=== End of lessons. ===
FOOTER
exit 0
