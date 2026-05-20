---
description: Start a disciplined bug-fix session with the escalation protocol
argument-hint: <description of the bug>
---

Use the **bug-doctor** subagent to investigate and fix this bug:

$ARGUMENTS

The bug-doctor must:
1. Read `.claude/ESCALATION.md`
2. Initialize `.claude/state/bugfix-tier` with `1`
3. Capture the bug report in `.claude/state/current-bug.md`
4. Reproduce the bug BEFORE editing any source code
5. Write `.claude/state/reproduction.md`
6. Write a failing test that demonstrates the bug
7. Only then begin investigating the fix

If anything in the bug description is ambiguous, the bug-doctor must
ask ONE clarifying question and stop. Do not guess.

The hooks will enforce reproduction-first and verify the fix at stop.
