#!/usr/bin/env bash
# UserPromptSubmit hook.
#
# When a bug-fix session is active, prepend the contract to EVERY user
# message so the agent cannot forget the constraint. The contract is
# brief and absolute. If the user is trying to end the session manually,
# this hook detects and respects that.
set -euo pipefail

INPUT=$(cat)
[ ! -f .claude/state/bugfix-tier ] && exit 0

prompt=$(echo "$INPUT" | jq -r '.prompt // ""')

# Detect a manual-end signal from the user. Only the user can write this.
# When detected, the next message's hook should let the session end.
manual_end_signals='\b(pull (out|the plug)|abandon|stop trying|give up|i.?ll take over|end (the )?session|close (the )?bug|i give up|enough)\b'
if echo "$prompt" | grep -qiE "$manual_end_signals"; then
  # The user is taking the loop off. Mark a manual-override flag.
  touch .claude/state/user-aborted
  cat <<EOF
[bug-fix override]
The user has signaled manual session end. The test-must-pass loop is
released for this session. Acknowledge briefly, write a postmortem to
.claude/state/bugfix-attempts.md describing what was tried and what
remains unsolved, then stop. Do NOT claim the bug is fixed.
EOF
  exit 0
fi

# Otherwise inject the contract reminder
last_exit=""
[ -f .claude/state/last-test-exit-code ] && last_exit=$(cat .claude/state/last-test-exit-code)
attempts=""
[ -f .claude/state/loop-attempts ] && attempts=$(cat .claude/state/loop-attempts)
test_cmd=""
[ -f .claude/state/test-command ] && test_cmd=$(cat .claude/state/test-command)

cat <<EOF
[bug-fix session active — contract reminder]
- Reproduction test command: ${test_cmd:-<not set>}
- Last test exit code: ${last_exit:-<never run>}  (0 = bug fixed)
- Stop-blocked attempts so far: ${attempts:-0}

Rules in force:
  1. You may not claim the bug is fixed unless the test command above
     exits 0.
  2. You may not edit, delete, or sed any file under .claude/state/.
  3. You may not stop until the test passes. The Stop hook runs the
     test itself.
  4. If you have run out of ideas, follow .claude/ESCALATION.md tier
     escalation. The only escape from the loop other than passing the
     test is the user manually saying so (e.g. "pull out", "abandon",
     "I'll take over").
EOF
exit 0
