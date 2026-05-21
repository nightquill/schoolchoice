#!/usr/bin/env bash
# PreToolUse on Write|Edit|MultiEdit|Bash.
#
# Prevents the obvious escape routes from the test-must-pass loop:
#   - Editing .claude/state/test-command to a passing command
#   - Deleting .claude/state/bugfix-tier to escape the session
#   - Modifying .claude/state/last-test-* to fake passage
#   - rm/mv/chmod on state files via Bash
#
# These files are the contract. Only the user, by hand, can modify them
# while a session is active.
set -euo pipefail

INPUT=$(cat)
[ ! -f .claude/state/bugfix-tier ] && exit 0

tool=$(echo "$INPUT" | jq -r '.tool_name // ""')

# Protected state files (relative paths)
protected_paths=(
  ".claude/state/test-command"
  ".claude/state/bugfix-tier"
  ".claude/state/last-test-exit-code"
  ".claude/state/last-test-timestamp"
  ".claude/state/last-test-run.log"
  ".claude/state/loop-attempts"
)

case "$tool" in
  Write|Edit|MultiEdit)
    path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
    [ -z "$path" ] && exit 0
    # Normalize: strip leading ./
    norm="${path#./}"
    for p in "${protected_paths[@]}"; do
      if [ "$norm" = "$p" ] || [ "$norm" = "./$p" ]; then
        cat >&2 <<EOF
BLOCKED: Editing $path is not allowed during an active bug-fix session.

This file is part of the test-must-pass loop contract. Only the user,
by hand outside the agent, may modify it. If the test command is wrong,
STOP and tell the user. Do not edit your way out of the loop.

The bug is not fixed until the existing test-command exits 0.
EOF
        exit 2
      fi
    done
    ;;

  Bash)
    cmd=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
    [ -z "$cmd" ] && exit 0

    # Patterns that target the state directory destructively
    danger_patterns=(
      'rm[[:space:]]+.*\.claude/state/'
      'mv[[:space:]]+.*\.claude/state/'
      'chmod[[:space:]]+.*\.claude/state/'
      '>[[:space:]]*\.claude/state/test-command'
      '>[[:space:]]*\.claude/state/bugfix-tier'
      '>[[:space:]]*\.claude/state/last-test'
      'tee[[:space:]]+.*\.claude/state/test-command'
      'tee[[:space:]]+.*\.claude/state/bugfix-tier'
      'sed[[:space:]]+.*-i.*\.claude/state/'
      "echo[[:space:]]+.*>[[:space:]]*\.claude/state/"
      "printf[[:space:]]+.*>[[:space:]]*\.claude/state/"
      'cat[[:space:]]+.*>[[:space:]]*\.claude/state/'
    )

    for pat in "${danger_patterns[@]}"; do
      if echo "$cmd" | grep -qE "$pat"; then
        cat >&2 <<EOF
BLOCKED: This bash command appears to modify or delete protected state files
under .claude/state/.

Command:
  $cmd

Matched pattern: $pat

During an active bug-fix session, .claude/state/ files are the contract.
Only the user can change them by hand. The agent cannot edit, overwrite,
or delete them via Write, Edit, or Bash.

If the test command is genuinely wrong, STOP and ask the user to fix it.
Do not invent another way to make the loop terminate.
EOF
        exit 2
      fi
    done
    ;;
esac
exit 0
