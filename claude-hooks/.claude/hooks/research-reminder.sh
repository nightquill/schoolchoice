#!/usr/bin/env bash
# UserPromptSubmit hook.
# When the user's prompt mentions libraries, APIs, or specific function/method
# names, prepend a reminder to verify before claiming. Cuts down on confidently
# wrong API signatures and made-up function names.
#
# stdout is appended to Claude's context for this turn.
set -euo pipefail

INPUT=$(cat)
prompt=$(echo "$INPUT" | jq -r '.prompt // ""')
[ -z "$prompt" ] && exit 0

if echo "$prompt" | grep -qiE '\b(api|library|package|module|sdk|endpoint|function|method|signature|how (do i|to) use|import|requires?|depends? on)\b'; then
  cat <<'EOF'
[research-reminder injected by hook]
Before claiming any API signature, method name, parameter, or library
behavior in your reply:
  1. If Context7 MCP is available, use it for current library docs.
  2. Otherwise, READ THE INSTALLED SOURCE under node_modules/site-packages.
  3. If you genuinely don't know, say "I don't know -- let me check" and
     read the source. Do not pattern-match from memory.

This applies even to popular libraries. APIs change between major versions
and your training data is stale relative to what's installed here.
EOF
fi
exit 0
