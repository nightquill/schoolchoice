# Claude Code enforcement hooks

Hooks that mechanically enforce the rules CLAUDE.md cannot. Each hook targets
one of the failure modes you've actually been hitting:

| Hook                            | Event           | Fixes                                                  |
|---------------------------------|-----------------|--------------------------------------------------------|
| block-echo-token.sh             | PreToolUse Bash | Railway/Vercel token rejection loop (trailing newline) |
| playwright-screenshot-guard.sh  | PostToolUse     | "Playwright is useless" -- oversized screenshots       |
| bug-fix-needs-test.sh           | Stop            | Bugs come back unfixed (regression tests)              |
| scope-guard.sh                  | PreToolUse Edit | Changes things you didn't ask for                      |
| no-new-md.sh                    | PreToolUse Write| SUMMARY.md / NOTES.md spam                             |
| no-fake-data.sh                 | PreToolUse Edit | Made-up data in data tasks                             |
| verify-imports.sh               | PostToolUse Edit| Hallucinated package imports                           |
| pre-stop-diff-audit.sh          | Stop            | Final check for scope creep                            |
| session-start-load-lessons.sh   | SessionStart    | Re-loads LESSONS.md so bugs don't repeat               |
| research-reminder.sh            | UserPromptSubmit| Nudge to verify APIs before claiming                   |

## Install

From the root of your project:

```bash
# Extract this archive into the project root so .claude/ merges in.
unzip claude-hooks.zip -d .

# Make all hooks executable.
chmod +x .claude/hooks/*.sh

# If you already have a .claude/settings.json, merge the "hooks" block manually
# instead of overwriting -- otherwise you'll lose your existing config.
```

Requirements: `bash`, `jq`, `git`. Most systems already have these. On macOS:
`brew install jq` if missing.

Verify:

```bash
# From inside Claude Code:
/hooks
```

You should see all 10 hooks listed under their events.

## Setup per-task workflow

For the scope guard to do anything, you have to declare scope per task. Open
`.claude/SCOPE` (create it) and put one glob per line:

```
src/auth/**
tests/auth/**
```

Anything else is read-only for that session. Clear or change it for the next task.

If you don't create `.claude/SCOPE`, the scope-guard and pre-stop-diff-audit
hooks silently do nothing -- safe default.

## Setup LESSONS.md (recommended)

Create `.claude/LESSONS.md` and add one-liners each time Claude makes a
mistake worth remembering. Example:

```markdown
# Lessons

- vercel/railway env vars: NEVER set with `echo X | command` -- appends \n
  and breaks the token. Use `printf '%s'` or interactive prompt.
- src/db/migrations: schema changes require a corresponding rollback file.
- Playwright in this repo: prefer browser_snapshot over screenshots for
  layout verification. Screenshots blow up past 8000px on /dashboard.
```

The SessionStart hook injects this into every new session, so Claude reads
it before doing anything. Add to it whenever Claude burns you on something.

## Disabling individual hooks

Easiest: remove the line from `.claude/settings.json` for the one hook you
want off. Or make the script non-executable: `chmod -x .claude/hooks/<name>.sh`.

To disable ALL hooks temporarily (debugging):

```json
{ "disableAllHooks": true, "hooks": { ... } }
```

## Notes on behavior

- `exit 2` in `PreToolUse` BLOCKS the action and sends stderr back to Claude
  as feedback. Claude sees the message and adapts.
- `exit 2` in `PostToolUse` cannot un-do the action, but sends stderr back as
  feedback for the next turn. Good for "you wrote bad code, fix it" nudges.
- `exit 2` in `Stop` prevents the session from ending and sends stderr to
  Claude. `stop_hook_active` flag prevents infinite loops -- checked in scripts.
- Hooks run even with `--dangerously-skip-permissions`. They cannot be
  bypassed by Claude.

## Tuning

After a week, you'll know which hooks fire too often (false positives) and
which never fire (dead weight). Iterate on the patterns. The scripts are
short and shell-readable; edit freely.

The no-fake-data hook in particular has a fairly aggressive pattern list and
may catch legitimate writes to docs/examples. Edit `patterns=()` in the
script if you hit false positives, or add the path to the exempt list at the
top of the script.
