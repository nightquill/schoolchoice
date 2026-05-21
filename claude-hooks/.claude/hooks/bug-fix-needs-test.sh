#!/usr/bin/env bash
# Stop hook.
# When the session was about fixing a bug, require that a test file was
# modified before allowing stop. This is the structural fix for "bugs come
# back unfixed" -- it forces a regression test, which makes regressions
# detectable in CI rather than re-discoverable by you in 3 weeks.
set -euo pipefail

INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

transcript=$(echo "$INPUT" | jq -r '.transcript_path // ""')
[ -z "$transcript" ] || [ ! -f "$transcript" ] && exit 0

# Look at user messages only -- avoid matching Claude's own "fix" talk.
bug_session=$(jq -r 'select(.message.role=="user") | .message.content
                     | if type=="array" then .[].text? // empty else . end' \
                "$transcript" 2>/dev/null \
              | grep -ciE '\b(bug|fix|broken|regression|crash|throws|exception|fails|failing|errored)\b' || true)

[ "${bug_session:-0}" -eq 0 ] && exit 0

# Did Claude modify a test file?
if ! command -v git >/dev/null 2>&1; then exit 0; fi
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

changed=$(git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
test_files=$(echo "$changed" | grep -iE '(^|/)(tests?|specs?|__tests__)/|\.(test|spec)\.[a-z]+$' || true)

if [ -z "$test_files" ]; then
  cat >&2 <<'EOF'
This session looks like a bug fix, but no test file was added or modified.

Before finishing, add a regression test that:
  1. Reproduces the bug WITHOUT your fix (fails)
  2. Passes WITH your fix (passes)

If the bug is genuinely untestable (UI/visual tweak, infra config), say so
explicitly in your final message and the user can override. Do NOT silently
skip the test.
EOF
  exit 2
fi
exit 0
