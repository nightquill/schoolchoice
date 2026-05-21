# Lessons learned

Append one-liners every time Claude makes a mistake worth remembering. This
file is injected into every new session by `session-start-load-lessons.sh`.

## Bugs documented from past sessions

- **Vercel/Railway env vars:** NEVER set with `echo "$X" | <cmd>` -- echo
  appends a trailing newline that silently breaks token auth and produces
  "invalid_client / token rejected" errors that re-appear after each
  rotation. Use `printf '%s' "$X" | <cmd>` or run the command interactively.

- **Playwright screenshots:** Claude's image input rejects anything over
  8000px on any side. For this project, prefer `browser_snapshot`
  (accessibility tree) for layout verification. Use screenshots only when
  the user explicitly asks, and clip to <=1920x1080.

- **Data tasks:** never invent rows, IDs, or sample values. Read the actual
  source file/db/API and quote the real bytes. If unsure where the data
  lives, ASK.

- **Library APIs:** never assume an API signature from memory. Read the
  installed source under node_modules / site-packages, or use Context7 MCP
  if available. Even popular libraries change between majors.

- **Scope discipline:** edit only files matching `.claude/SCOPE`. If a
  change outside scope feels necessary, STOP and ask the user before doing
  it.
