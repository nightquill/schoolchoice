# Bug-fix escalation protocol

When you're stuck on a bug, you are not allowed to keep trying variations
of the same approach. You must escalate through these tiers in order. Each
tier forces a more disciplined process than the last.

You are escalated to the next tier when:
- You've made 3 attempts at the same surface-level area, OR
- The same error has occurred 4+ times, OR
- The user has told you you're stuck, OR
- The state file `.claude/state/bugfix-tier` says so.

After each tier you must update `.claude/state/bugfix-tier` and run the
checklist for the new tier. Do not skip tiers.

---

## Tier 1: REPRODUCE (mandatory before any fix attempt)

Before you change a single line of code, you must have a deterministic
reproduction. No exceptions.

Checklist (output the answers in your reply):

1. **Exact reproduction steps**: enumerated, copy-pasteable, deterministic.
   "Click around the dashboard" is not a reproduction. "Run `npm test
   src/auth/login.test.ts -- -t 'expired token'`" is.

2. **Expected vs actual output**: not paraphrased. The real strings, the
   real stack trace, the real exit code. Run the reproduction and paste
   the output verbatim.

3. **Reproduction reliability**: 100% deterministic? Or flaky? If flaky,
   what's the failure rate? (Flaky bugs need Tier 2 immediately — you
   cannot fix what you cannot reliably trigger.)

4. **Write the reproduction as a test**: even if temporary. A failing test
   that demonstrates the bug. Commit it (or save the test ID). This becomes
   your verification at the end — and if the bug ever recurs, this test
   catches it.

If you cannot reproduce after 15 minutes of trying, escalate to Tier 2.
Do NOT proceed to fixing a bug you cannot trigger.

## Tier 2: ISOLATE (when reproduction is hard or fix attempts failed)

You're escalated here because Tier 1 fix attempts didn't work, or you
couldn't get a clean reproduction. The new constraint: stop pattern-
matching from the symptom. Find the actual failure point.

Checklist:

1. **Where does correct behavior end?** Add logging (or breakpoints, or
   `print`/`console.log`) at every layer the data passes through, from
   user input to error. Run the reproduction. Note the LAST place data
   looked correct and the FIRST place it didn't. The bug lives between
   those two points.

2. **Binary-search the diff**: if the bug appeared recently, `git log` the
   suspected file. Use `git bisect` if you can — it's not just for big
   codebases. The commit that broke it usually contains the bug.

3. **Minimal failing input**: shrink the reproduction to the smallest
   possible input that still fails. Half the input, does it still fail?
   Half again. You're looking for the smallest delta between "passes"
   and "fails".

4. **Read the actual code along the failure path.** Not the filenames.
   Not the function signatures. Open every file the data passes through
   and read it. State out loud (in your reply) what each function does.
   When your stated description differs from what the code actually does,
   that's often the bug.

If after Tier 2 you have a clear failure point but no fix is working,
escalate to Tier 3.

## Tier 3: ASSUMPTIONS AUDIT (when isolation didn't help)

Escalated here because you've found where it fails but fixes don't stick
or have side effects. The bug isn't where you think it is. Something you
believe to be true isn't.

Checklist:

1. **List every assumption you've been making.** Examples:
   - "This function is always called with a non-null arg"
   - "The DB returns rows in insertion order"
   - "This is called once per request"
   - "The config is loaded before this runs"
   - "Timezone is UTC"
   - "The user is authenticated by this point"

   Write down 5-10. Be exhaustive.

2. **For each assumption, write the one-line VERIFICATION**: how would
   you actually prove it true? Then run that verification. Don't reason
   about it — verify with code or a log.

3. **One of them is false.** Find it. The bug almost always lives in
   the false assumption.

4. **Check the boundaries**: empty input, null, undefined, zero, negative,
   very large, unicode, concurrent calls, slow network. The bug often
   isn't in the logic but in an unhandled boundary case in surrounding
   code.

If Tier 3 doesn't yield it, escalate to Tier 4.

## Tier 4: REWIND AND RESTART (last resort, but disciplined)

You're stuck because your context is polluted with failed attempts. Not
because the bug is unfixable.

Process:

1. **Write a postmortem of the last 3 attempts** to
   `.claude/state/bugfix-attempts.md`:
   - What you tried
   - Why you thought it would work
   - Why it didn't
   - What you learned (concretely; "I learned X is not the cause")

2. **Append a one-liner to `.claude/LESSONS.md`** capturing the most
   surprising finding from this session. This survives /clear and the
   next attempt benefits.

3. **Write a fresh problem statement** in `.claude/state/fresh-prompt.md`
   that:
   - Describes the bug in plain language (not narratively from this
     session's confusion)
   - Lists the verified reproduction from Tier 1
   - Lists what's been RULED OUT (so the next session doesn't repeat it)
   - States the smallest sensible next step (not the whole fix — just
     the next hypothesis to test)

4. **Tell the user to /clear and paste the fresh prompt.** The new
   session is not the same as this one. It has the lessons, the ruled-
   out attempts, the verified reproduction. It is not starting over;
   it is continuing with less noise.

## What you may NOT do at any tier

- Claim the bug is fixed without showing the reproduction now passes.
- Claim tests pass without running them this turn and pasting the output.
- "Refactor" code in the failure path without naming the specific change
  that fixes the specific bug.
- Add try/except around the failure to make the error go away. That's
  hiding the bug, not fixing it.
- Tell the user "this should work now, please verify." YOU verify.
- Move to a different bug while this one is unresolved.
- Skip tiers. If Tier 1 was hard, you don't skip to Tier 3.

## Compliance

This protocol is not advisory. The escalation hooks in this package will
detect when you're stuck and force you here. The verify hooks will catch
you if you claim a fix without running the reproduction. The state files
in `.claude/state/` are the audit trail.

Your job is to use the protocol as the work-ethic backbone. The "agent
can't do this" claim is reserved for cases where you've genuinely been
through all four tiers and produced honest postmortem notes. It is not
a way to avoid Tier 1.
