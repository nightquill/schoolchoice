#!/usr/bin/env bash
# PostToolUse on Bash. Counts attempts and auto-escalates tier when
# the agent looks stuck. Updates .claude/state/bugfix-tier and writes
# an instruction to Claude to follow the new tier's checklist.
set -euo pipefail

INPUT=$(cat)
[ ! -f .claude/state/bugfix-tier ] && exit 0

tier=$(cat .claude/state/bugfix-tier)
attempts_file=.claude/state/attempts-count
errors_file=.claude/state/error-fingerprints

# Count edits + test runs as "attempts" by tracking unique tool invocations.
# Simpler: look at git for change count since session start, and at recent
# error patterns in tool output.

command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Get error fingerprint from this command's output, if any.
output=$(echo "$INPUT" | jq -r '.tool_response.stdout // .tool_response.output // ""')
stderr=$(echo "$INPUT" | jq -r '.tool_response.stderr // ""')
combined="$output$stderr"

if echo "$combined" | grep -qiE '(error:|Error:|FAIL|Traceback|exception|exit (code|status) [^0])'; then
  # Hash a normalized fingerprint of the error
  fp=$(echo "$combined" | grep -iE '(error:|Error:|FAIL|Traceback|exception)' | head -3 | tr -s ' ' | md5sum | cut -c1-12)
  echo "$fp" >> "$errors_file"
fi

# Check escalation triggers
should_escalate=false
reason=""

if [ -f "$errors_file" ]; then
  # Same error 4+ times → escalate
  max_repeats=$(sort "$errors_file" | uniq -c | sort -rn | head -1 | awk '{print $1}')
  max_repeats=${max_repeats:-0}
  if [ "$max_repeats" -ge 4 ]; then
    should_escalate=true
    reason="same error has occurred $max_repeats times"
  fi

  # 8+ distinct errors → also escalate (thrashing across many failures)
  total_errors=$(wc -l < "$errors_file" 2>/dev/null || echo 0)
  if [ "$total_errors" -ge 8 ] && [ "$should_escalate" = false ]; then
    should_escalate=true
    reason="$total_errors errors encountered, no convergence"
  fi
fi

# Many file edits without success → escalate
edits=$( (git diff --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null) \
        | sort -u | { grep -v '^.claude/' || true; } | wc -l | awk '{print $1}')
edits=${edits:-0}
if [ "$edits" -ge 6 ] && [ "$should_escalate" = false ]; then
  should_escalate=true
  reason="$edits files modified without a verified fix"
fi

if [ "$should_escalate" = true ] && [ "$tier" -lt 4 ]; then
  new_tier=$((tier + 1))
  echo "$new_tier" > .claude/state/bugfix-tier
  rm -f "$errors_file"  # reset counter for the next tier

  case "$new_tier" in
    2) name="ISOLATE" ;;
    3) name="ASSUMPTIONS AUDIT" ;;
    4) name="REWIND AND RESTART" ;;
  esac

  cat >&2 <<EOF
=== ESCALATED to Tier $new_tier: $name ===

Reason: $reason

Tier $tier did not converge. You must now follow the Tier $new_tier checklist
in .claude/ESCALATION.md. Stop the current line of attempts. Open
ESCALATION.md, read the Tier $new_tier section, and follow the checklist
in order. Do not continue with the same approach that failed at Tier $tier.

If you reach Tier 4 without a fix, write the postmortem and stop. Do not
loop back to Tier 1 without /clear.
EOF
  exit 2
fi
exit 0
