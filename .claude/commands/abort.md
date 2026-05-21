---
description: Manually abort the current bug-fix loop without a fix (user override)
---

The user is pulling out of the bug-fix loop manually. The bug is NOT
fixed; the user is taking over or shelving the work.

Do these in order:

1. Verify a session is active: check that `.claude/state/bugfix-tier`
   exists. If not, tell the user there's nothing to abort and stop.

2. Write a postmortem to `.claude/state/bugfix-attempts.md`:
   ```
   # Bug-fix postmortem (user-aborted)
   Date: <date>

   ## Bug
   <one-line from .claude/state/current-bug.md>

   ## Verified reproduction
   <copy from .claude/state/reproduction.md or note that none was completed>

   ## What I tried (in order)
   ### Attempt 1: <title>
   - Hypothesis: ...
   - Action: ...
   - Result (from test output): ...
   - Lesson: <what this ruled out>

   ### Attempt 2 ...
   ### Attempt N ...

   ## Current state of the test
   - Command: <contents of .claude/state/test-command>
   - Last exit code: <contents of .claude/state/last-test-exit-code>
   - Total blocked stops: <contents of .claude/state/loop-attempts>

   ## What I now believe about the bug
   <honest 3-5 sentence assessment>

   ## Where I would look next, with a clean head
   <smallest next experiment for the next session>
   ```

3. Append one line to `.claude/LESSONS.md`:
   ```
   - <date>: <bug summary> -- stuck after N attempts. Next time check <thing>
     earlier.
   ```

4. Touch `.claude/state/user-aborted` to release the Stop hook:
   ```
   touch .claude/state/user-aborted
   ```
   The Stop hook recognizes this file and archives the session state on
   the next stop.

5. Print to the user:
   - Path to the postmortem
   - Path to the fresh-start prompt (if you want to make one for /clear)
   - Confirmation that the loop is released

6. Stop. Do NOT continue working on the bug. The user is taking over.

This is not failure. The protocol explicitly includes user-abort as the
fourth escape. Treat it with dignity.
