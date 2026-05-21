#!/usr/bin/env bash
# Stop hook for active bug-fix sessions.
# Before stopping, requires that:
#   1. The reproduction test that was written in Tier 1 now PASSES
#   2. The fix is described in .claude/state/fix-summary.md
#   3. The state is closed out (tier file removed)
#
# This is the contract: you don't get to claim a bug fixed without the
# original reproduction now passing.
set -euo pipefail

INPUT=$(cat)
[ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
[ ! -f .claude/state/bugfix-tier ] && exit 0

transcript=$(echo "$INPUT" | jq -r '.transcript_path // ""')
[ -z "$transcript" ] || [ ! -f "$transcript" ] && exit 0

# Did the last assistant message claim the bug is fixed?
last_assistant=$(jq -r '
  select(.message.role=="assistant") | .message.content |
  if type=="array" then [.[] | select(.type=="text") | .text] | join(" ")
  else . end' "$transcript" 2>/dev/null | tail -3 | tr '\n' ' ')

claims_fix=false
if echo "$last_assistant" | grep -qiE '\b(fix(ed)?|resolved?|bug.*(is )?(gone|gone away|squashed)|works (now|correctly)|root caused?|done|complete)\b'; then
  claims_fix=true
fi

# If not claiming fix, allow stop but leave tier active.
[ "$claims_fix" = false ] && exit 0

# Claim is being made. Check requirements.
missing=()

if [ ! -f .claude/state/reproduction.md ] || [ ! -s .claude/state/reproduction.md ]; then
  missing+=("reproduction not on file (.claude/state/reproduction.md)")
fi

if [ ! -f .claude/state/fix-summary.md ] || [ ! -s .claude/state/fix-summary.md ]; then
  missing+=("fix not summarized (.claude/state/fix-summary.md)")
fi

# Did Claude actually run the reproduction this session?
test_runs=$(jq -r '
  select(.message.role=="assistant") | .message.content |
  if type=="array" then [.[] | select(.type=="tool_use" and .name=="Bash") | .input.command] | join("\n")
  else empty end' "$transcript" 2>/dev/null \
  | { grep -iE '\b(test|pytest|jest|vitest|mocha|cargo test|go test|rspec)\b' || true; } | wc -l | tr -d ' ')
test_runs=${test_runs:-0}

if [ "$test_runs" -eq 0 ]; then
  missing+=("no test command ran this session — claim of fix is unverified")
fi

# Did the most recent test output pass?
last_test_output=$(jq -r '
  select(.message.role=="user") | .message.content |
  if type=="array" then [.[] | select(.type=="tool_result") | (.content // [] | if type=="array" then .[].text? // empty else . end)] | join("\n")
  else empty end' "$transcript" 2>/dev/null | tail -300)

if echo "$last_test_output" | grep -qiE '(FAIL|FAILED|failing|✗|✘|[1-9][0-9]* (failed|failing)|exit (code|status) [^0])' ; then
  missing+=("most recent test output shows failures — fix did not verify")
fi

if [ ${#missing[@]} -gt 0 ]; then
  cat >&2 <<EOF
BUG-FIX VERIFICATION FAILED. You claim the bug is fixed, but:

$(printf '  - %s\n' "${missing[@]}")

Required to close out this bug-fix session:
  1. Reproduction documented in .claude/state/reproduction.md
  2. Failing test from Tier 1 now PASSES (run it this turn, show output)
  3. Fix summary in .claude/state/fix-summary.md:
       - What was the root cause? (not "I changed X" — WHY did X fix it?)
       - What was the surface symptom vs the underlying bug?
       - What did the fix change, in one paragraph?
  4. Append the lesson to .claude/LESSONS.md so this doesn't recur
  5. After all above: remove .claude/state/bugfix-tier to close the session

Do not claim a bug fixed without running the reproduction this turn.
"Should work" is not "does work".
EOF
  exit 2
fi

# All checks passed. Auto-close the session state.
rm -f .claude/state/bugfix-tier .claude/state/attempts-count .claude/state/error-fingerprints
echo "[bug-fix verified and closed — state files reset]" >&2
exit 0
