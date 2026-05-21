#!/usr/bin/env bash
# PreToolUse on Write|Edit|MultiEdit.
# Detects classic markers of fabricated data and blocks the write.
# Files under tests/, fixtures/, examples/ or named *.fixture.* are exempt.
set -euo pipefail

INPUT=$(cat)
content=$(echo "$INPUT" | jq -r '
  .tool_input.content //
  .tool_input.new_string //
  ((.tool_input.edits // []) | map(.new_string) | join("\n")) //
  ""')
path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
[ -z "$content" ] && exit 0

# Exempt fixture/test/example files.
case "$path" in
  *test*|*tests*|*spec*|*specs*|*fixture*|*fixtures*|*example*|*mock*|*sample*|*demo*|*.stories.*)
    exit 0 ;;
esac

# Patterns that scream "I made this up".
patterns=(
  'lorem ipsum'
  '\bjohn doe\b'
  '\bjane doe\b'
  '\bfoo@bar\b'
  'example@example\.'
  'test@test\.com'
  '"?placeholder"?[[:space:]]*[:=]'
  'TODO:[[:space:]]*replace'
  'FIXME:[[:space:]]*real data'
  '\b1234567890\b'
  'xxx-xxx-xxxx'
  '\bAAA-?BBB-?CCC\b'
  '\bacme[[:space:]]+(corp|inc|co)\b'
  '\b123 main st(reet)?\b'
)

found=""
for p in "${patterns[@]}"; do
  match=$(echo "$content" | grep -iE "$p" | head -2 || true)
  if [ -n "$match" ]; then
    found="${found}  pattern: $p\n  found:   $(echo "$match" | head -1 | cut -c1-80)\n\n"
  fi
done

if [ -n "$found" ]; then
  cat >&2 <<EOF
BLOCKED: Write to '$path' contains placeholder/fabricated-data markers:

$(printf "%b" "$found")
If you were inventing values instead of reading from a real source, STOP. Do
one of these instead:

  1. Read the actual data file/database/API and use real values
  2. Ask the user where the data should come from
  3. If this is intentionally a fixture, put it under tests/ or fixtures/
     or name the file *.fixture.<ext> -- those paths are exempt.

Never fabricate data the user will mistake for real.
EOF
  exit 2
fi
exit 0
