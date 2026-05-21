#!/usr/bin/env bash
# SessionStart hook.
# Injects ESCALATION.md plus current tier state into Claude's context.
# stdout is added to the context.
set -euo pipefail

cat <<'HEADER'
=== BUG-FIX ESCALATION PROTOCOL (mandatory) ===
The following protocol governs any bug-fix work this session. When stuck,
you must escalate through tiers. The hooks in this repo will enforce it.
HEADER

[ -f .claude/ESCALATION.md ] && cat .claude/ESCALATION.md

echo ""
echo "=== Current tier state ==="
if [ -f .claude/state/bugfix-tier ]; then
  echo "Tier: $(cat .claude/state/bugfix-tier)"
  if [ -f .claude/state/current-bug.md ]; then
    echo ""
    echo "Current bug context:"
    cat .claude/state/current-bug.md
  fi
else
  echo "No active bug-fix session. (Tier becomes 1 when bug work starts.)"
fi

echo ""
if [ -f .claude/state/bugfix-attempts.md ]; then
  echo "=== Postmortem of prior attempts (do not repeat these): ==="
  cat .claude/state/bugfix-attempts.md
fi

if [ -f .claude/LESSONS.md ]; then
  echo ""
  echo "=== Lessons learned (read and apply): ==="
  cat .claude/LESSONS.md
fi
exit 0
