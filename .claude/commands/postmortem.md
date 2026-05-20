---
description: Write Tier 4 postmortem and fresh-prompt for /clear restart
---

You've reached Tier 4 of the escalation protocol. The current context is
polluted; the next attempt needs a clean restart with the lessons
preserved.

Do these in order:

1. **Write `.claude/state/bugfix-attempts.md`** — postmortem of what
   was tried:
   ```
   # Postmortem of bug-fix attempts
   ## Bug
   <one-line summary, refer to .claude/state/current-bug.md>

   ## Verified reproduction
   <copy from .claude/state/reproduction.md if exists; if not,
    note that reproduction was never achieved — this is itself
    important information>

   ## Attempts that did NOT work, in order
   ### Attempt 1: <one-line description>
   - Hypothesis: <what I thought was wrong>
   - Action: <what I changed>
   - Result: <why it didn't work>
   - Lesson: <what is now RULED OUT>

   ### Attempt 2: ...
   ### Attempt 3: ...

   ## What I now believe about the bug
   <3-5 sentences; honest assessment>

   ## What I would investigate next, with a clean head
   <smallest next experiment — not the whole fix>
   ```

2. **Append a lesson to `.claude/LESSONS.md`**:
   ```
   - <date>: <bug summary> — investigation was stuck because <root reason>.
     Next time, check <specific thing> earlier.
   ```

3. **Write `.claude/state/fresh-prompt.md`** — the prompt the user will
   paste into a fresh session after /clear:
   ```
   # Continue bug investigation: <short title>

   ## The bug
   <plain language; not narrative from past session>

   ## Verified reproduction
   <from reproduction.md if exists>

   ## What's already been RULED OUT (do not repeat)
   - <attempt 1 ruled out cause X>
   - <attempt 2 ruled out cause Y>
   - <attempt 3 ruled out cause Z>

   ## Next experiment to try
   <the smallest next step from the postmortem>

   ## Files relevant to this bug
   <list with one-line context for each>
   ```

4. **Tell the user**:
   - "Postmortem written to .claude/state/bugfix-attempts.md"
   - "Fresh prompt written to .claude/state/fresh-prompt.md"
   - "Run /clear, then paste the contents of fresh-prompt.md into the new session"
   - "The new session is not starting over — it has the lessons and rule-outs"

5. After printing this, do NOT continue working. The user controls the
   reset.

Hard rule: this is not an admission of defeat. It is the disciplined
restart that's part of the protocol. Frame it that way.
