#!/usr/bin/env bash
# PostToolUse on Write|Edit|MultiEdit.
#
# After every code edit during an active bug-fix session, auto-run the
# reproduction test and tell the agent the real exit code. This gives
# the agent immediate, mechanical feedback on whether what it just did
# actually moved the needle.
#
# This is the "let it loop on the problem" engine. The agent edits, the
# hook runs the test, the agent sees the result, the agent edits again.
# No human in the loop. No grep-for-claims theater. Real test execution
# after every change.
set -euo pipefail

INPUT=$(cat)
[ ! -f .claude/state/bugfix-tier ] && exit 0
[ ! -f .claude/state/test-command ] && exit 0

cmd=$(cat .claude/state/test-command)
[ -z "$cmd" ] && exit 0

# Don't auto-run on edits to .claude/state itself
path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
case "$path" in
  *.claude/state/*) exit 0 ;;
  *.claude/*) exit 0 ;;  # don't trigger on config edits either
esac

# Throttle: don't re-run if we ran the test in the last 5 seconds (avoid
# re-running for every line of a MultiEdit)
LOG_DIR=".claude/state"
TS_FILE="$LOG_DIR/last-test-timestamp"
if [ -f "$TS_FILE" ]; then
  last=$(cat "$TS_FILE" 2>/dev/null || echo "")
  if [ -n "$last" ]; then
    last_epoch=$(date -u -d "$last" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last" +%s 2>/dev/null || echo 0)
    now_epoch=$(date -u +%s)
    if [ $((now_epoch - last_epoch)) -lt 5 ]; then
      exit 0
    fi
  fi
fi

# Run the test
LOG_FILE="$LOG_DIR/last-test-run.log"
set +e
bash -c "$cmd" > "$LOG_FILE" 2>&1
rc=$?
set -e

echo "$rc" > "$LOG_DIR/last-test-exit-code"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$TS_FILE"

if [ "$rc" -eq 0 ]; then
  cat >&2 <<EOF
============================================================
REPRODUCTION TEST PASSES after this edit.
============================================================
Command: $cmd
Exit:    0

The bug appears to be fixed. You may now finish — when the session
stops, the test will be re-run as final confirmation. Make sure no
further edits regress this.
EOF
  exit 0
fi

# Test failing. Surface the failure so the agent sees it BEFORE writing
# a "fixed" claim.
output_tail=$(tail -20 "$LOG_FILE" 2>/dev/null || echo "(no output)")

cat >&2 <<EOF
============================================================
REPRODUCTION TEST STILL FAILS after this edit.
============================================================
Command: $cmd
Exit:    $rc (must be 0 to pass)

Tail of output:
$output_tail

You may NOT claim the bug is fixed. The test ran and failed. Keep
working until exit 0.
EOF

# Exit 2 from PostToolUse cannot un-do the edit but surfaces the message
# to the agent for its next decision. We want this visible.
exit 2
