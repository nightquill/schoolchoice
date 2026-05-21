#!/usr/bin/env bash
# SessionStart hook.
# Inject the active bug-fix contract into the agent's context at the start
# of every session so it can't pretend it doesn't know the rules.
set -euo pipefail

if [ ! -f .claude/state/bugfix-tier ]; then
  exit 0
fi

tier=$(cat .claude/state/bugfix-tier)
cmd=""
[ -f .claude/state/test-command ] && cmd=$(cat .claude/state/test-command)
last_exit=""
[ -f .claude/state/last-test-exit-code ] && last_exit=$(cat .claude/state/last-test-exit-code)
attempts="0"
[ -f .claude/state/loop-attempts ] && attempts=$(cat .claude/state/loop-attempts)

cat <<EOF
============================================================
ACTIVE BUG-FIX SESSION (tier $tier) -- TEST-MUST-PASS LOOP IN EFFECT
============================================================

Reproduction test command: ${cmd:-<NOT SET — set this or you cannot stop>}
Last test exit code:       ${last_exit:-<never run>}  (0 = bug fixed)
Stop-blocked count:        $attempts

The session ends ONLY when the reproduction test command exits 0. The
Stop hook runs the test itself; your claims of "fixed" do not stop the
session. The PostToolUse hook auto-runs the test after every code edit
and reports the real exit code back to you.

You may not:
  - Edit .claude/state/test-command, .claude/state/bugfix-tier, or any
    .claude/state/last-test-* file (PreToolUse blocks this)
  - Run rm/mv/sed/echo > against .claude/state/ files (PreToolUse blocks
    this)
  - Write a "fix complete" claim without the test exiting 0

The only escapes from the loop are:
  1. Make the test exit 0 by actually fixing the bug.
  2. The user manually says one of: "pull out", "abandon", "give up",
     "I'll take over", "end session". Until then, keep working.

If you are out of ideas, follow .claude/ESCALATION.md tier by tier. Tier 4
is a postmortem -- not a false fix claim.

Recent test output (tail):
EOF

if [ -f .claude/state/last-test-run.log ]; then
  tail -20 .claude/state/last-test-run.log
else
  echo "(no test runs yet)"
fi

echo ""
echo "============================================================"
echo ""

# Also load LESSONS.md and ESCALATION.md if present
if [ -f .claude/ESCALATION.md ]; then
  echo "=== Escalation protocol (.claude/ESCALATION.md): ==="
  cat .claude/ESCALATION.md
  echo ""
fi

if [ -f .claude/LESSONS.md ]; then
  echo "=== Lessons learned (.claude/LESSONS.md): ==="
  cat .claude/LESSONS.md
fi
exit 0
