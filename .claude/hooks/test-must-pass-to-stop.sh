#!/usr/bin/env bash
# Stop hook. THE WALL.
#
# When a bug-fix session is active, the only way to stop is for the
# reproduction test command to exit 0. The agent's words are irrelevant.
# The hook runs the test itself and reads the actual exit code.
#
# Exit 2 from Stop blocks the session from ending. Agent gets feedback,
# tries again, cannot end until test passes. Loop forever (until user
# manually aborts via a phrase the inject-contract hook recognizes).
set -euo pipefail

INPUT=$(cat)
[ ! -f .claude/state/bugfix-tier ] && exit 0

# User-aborted: the user said "pull out / abandon / give up". Allow stop.
if [ -f .claude/state/user-aborted ]; then
  mkdir -p .claude/state/aborted
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  for f in bugfix-tier test-command reproduction.md fix-summary.md \
           last-test-run.log last-test-exit-code last-test-timestamp \
           loop-attempts user-aborted current-bug.md; do
    [ -f ".claude/state/$f" ] && mv ".claude/state/$f" ".claude/state/aborted/$ts-$f"
  done
  echo "[bug-fix session manually aborted by user, state archived under .claude/state/aborted/]" >&2
  exit 0
fi

if [ ! -f .claude/state/test-command ]; then
  cat >&2 <<'INNER'
BUG-FIX SESSION ACTIVE but no reproduction-test command is on file.

Before you can stop, write the command that runs the failing reproduction
test to .claude/state/test-command. Example:
  echo "npm test -- src/auth/login.test.ts -t 'expired token rejected'" > .claude/state/test-command

The hook runs this command itself. The agent's claims about fixing are
not used.
INNER
  exit 2
fi

cmd=$(cat .claude/state/test-command)
if [ -z "$cmd" ]; then
  echo "BUG-FIX SESSION ACTIVE but .claude/state/test-command is empty." >&2
  echo "Write a command that exits 0 only when the bug is fixed." >&2
  exit 2
fi

LOG_DIR=".claude/state"
LOG_FILE="$LOG_DIR/last-test-run.log"
ATTEMPTS_FILE="$LOG_DIR/loop-attempts"

attempts=0
[ -f "$ATTEMPTS_FILE" ] && attempts=$(cat "$ATTEMPTS_FILE")
attempts=$((attempts + 1))
echo "$attempts" > "$ATTEMPTS_FILE"

# RUN THE TEST. Real exit code is the only thing that matters.
set +e
bash -c "$cmd" > "$LOG_FILE" 2>&1
rc=$?
set -e

echo "$rc" > "$LOG_DIR/last-test-exit-code"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$LOG_DIR/last-test-timestamp"

if [ "$rc" -eq 0 ]; then
  # Genuinely fixed.
  rm -f "$LOG_DIR/bugfix-tier" \
        "$LOG_DIR/loop-attempts" \
        "$LOG_DIR/error-fingerprints" \
        "$LOG_DIR/attempts-count" \
        "$LOG_DIR/user-aborted"
  cat >&2 <<INNER
============================================================
REPRODUCTION TEST PASSED. Bug-fix session closed.
============================================================
Command: $cmd
Attempts to pass: $attempts
Log: $LOG_FILE
INNER
  exit 0
fi

# Test still fails. Block stop. Loop.
output_tail=$(tail -30 "$LOG_FILE" 2>/dev/null || echo "(no output)")

cat >&2 <<INNER
============================================================
STOP BLOCKED. The reproduction test still fails.
============================================================

Reproduction command:   $cmd
Exit code:              $rc  (must be 0 to pass)
Block #:                $attempts
Log:                    $LOG_FILE

Tail of test output:
$output_tail

The bug is NOT fixed. You may not claim it is. You may not stop. The only
way out of this loop is for the above command to exit 0 when this hook
re-runs it on the next stop attempt.

You may NOT:
  - Modify .claude/state/test-command (PreToolUse hook blocks this)
  - Delete .claude/state/bugfix-tier (PreToolUse hook blocks this)
  - Wrap the failing code in try/except to silence the error
  - Claim the test is "flaky" or "wrong" -- STOP and tell the user instead

Continue working. The next edit will trigger an auto-test run, and the
next stop attempt will re-run the test. Make exit code 0 happen.
INNER
exit 2
