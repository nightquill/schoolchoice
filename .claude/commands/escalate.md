---
description: Manually escalate the current bug-fix tier when you see Claude is stuck
---

The user has determined that the current approach is not working and
you need to escalate to the next tier of the bug-fix protocol.

Do this in order:

1. Read the current tier from `.claude/state/bugfix-tier`. If the file
   doesn't exist, tell the user there's no active bug-fix session and
   stop.

2. Increment the tier by 1 (max 4) and write it back to the file.

3. Read `.claude/ESCALATION.md` and find the new tier's section.

4. Print a short summary to the user:
   - "Escalated from Tier N to Tier N+1: <tier name>"
   - The new checklist (3-5 bullets summarizing what the new tier requires)
   - What you're going to do FIRST under the new tier

5. STOP and wait for the user to confirm before starting the new tier's
   work. They escalated for a reason; they may want to redirect.

If you're at Tier 4 and escalated again, write the postmortem, write the
fresh prompt, and tell the user to /clear.
