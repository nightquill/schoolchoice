#!/usr/bin/env bash
# PreToolUse on Edit|Write|MultiEdit.
# In an active bug-fix session, blocks code edits until a reproduction is
# on file. Forces Tier 1 compliance.
#
# Activated when:
#   - .claude/state/bugfix-tier exists (a bug-fix session is active), AND
#   - .claude/state/reproduction.md does NOT exist or is empty
#
# Skipped when:
#   - The file being edited is a test file (writing the reproduction test
#     is allowed and encouraged)
#   - The file is in .claude/state/ (state file updates are allowed)
set -euo pipefail

INPUT=$(cat)
[ ! -f .claude/state/bugfix-tier ] && exit 0

path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
[ -z "$path" ] && exit 0

# Allow state-file edits and test-file edits unconditionally.
case "$path" in
  *.claude/state/*|*test*|*tests*|*spec*|*specs*|*__tests__*|*.test.*|*.spec.*)
    exit 0 ;;
esac

if [ ! -f .claude/state/reproduction.md ] || [ ! -s .claude/state/reproduction.md ]; then
  cat >&2 <<'EOF'
BLOCKED: Tier 1 requires a reproduction BEFORE any code edits to non-test files.

Before editing source code, do these in order:
  1. Determine the exact reproduction steps (run the failing case)
  2. Capture expected vs actual output verbatim
  3. Write the answer to `.claude/state/reproduction.md` with:

     # Reproduction
     ## Steps
     1. ...
     ## Expected
     ...
     ## Actual
     ...
     ## Reliability
     <100% deterministic | flaky N%>

  4. Write a failing test that demonstrates the bug (test files are
     unblocked; edit them freely).

You may NOT skip this. "I'm confident I know the fix" is not a reason —
the protocol exists because that confidence is wrong about 60% of the
time and produces fixes that don't fix the actual bug.
EOF
  exit 2
fi
exit 0
