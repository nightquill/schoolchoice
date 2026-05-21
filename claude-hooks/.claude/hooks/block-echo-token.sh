#!/usr/bin/env bash
# PreToolUse on Bash.
# Blocks `echo "$TOKEN" | vercel env add ...` style commands that append a
# trailing newline to the secret and cause every subsequent auth to fail.
set -euo pipefail

INPUT=$(cat)
cmd=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
[ -z "$cmd" ] && exit 0

# echo (without -n) piped to any common secret-setting command
if echo "$cmd" | grep -qE '\becho\b[^|]*\|[[:space:]]*(npx[[:space:]]+)?(vercel[[:space:]]+env|railway[[:space:]]+(variables|run)|fly[[:space:]]+secrets|flyctl[[:space:]]+secrets|heroku[[:space:]]+config|gh[[:space:]]+secret|wrangler[[:space:]]+secret|doppler[[:space:]]+secrets|aws[[:space:]]+(ssm|secretsmanager)|gcloud[[:space:]]+secrets|kubectl[[:space:]]+create[[:space:]]+secret|op[[:space:]]+item)'; then
  if ! echo "$cmd" | grep -qE '\becho[[:space:]]+-n\b'; then
    cat >&2 <<'EOF'
BLOCKED: `echo "..." | <secret-set-command>` appends a trailing newline (\n) to
the secret. This is the #1 cause of "token invalid / rejected" errors that
re-appear after every rotation -- the token is fine, the stored value has \n
on the end.

Use ONE of:
  printf '%s' "$TOKEN" | <command>             # no trailing newline
  echo -n "$TOKEN"     | <command>             # also fine, GNU/BSD echo
  <command>                                    # interactive: paste when prompted

Then verify the stored value has no trailing whitespace:
  vercel env pull .env.local && cat -A .env.local | head
EOF
    exit 2
  fi
fi
exit 0
