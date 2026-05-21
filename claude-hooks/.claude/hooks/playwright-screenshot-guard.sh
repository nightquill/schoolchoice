#!/usr/bin/env bash
# PostToolUse on mcp__playwright__browser_take_screenshot.
# Catches screenshots that exceed Claude's 8000px input dimension limit
# (the symptom you described: "playwright is useless because Claude doesn't
# read screenshots" -- the API actually rejects them).
set -euo pipefail

INPUT=$(cat)

# Try to find the most recent screenshot. Playwright MCP saves to .playwright-mcp/.
# Also check tool_input for an explicit filename.
fname=$(echo "$INPUT" | jq -r '.tool_input.filename // ""')

if [ -n "$fname" ] && [ -f "$fname" ]; then
  target="$fname"
elif [ -d .playwright-mcp ]; then
  target=$(ls -t .playwright-mcp/*.png .playwright-mcp/*.jpg 2>/dev/null | head -1)
else
  exit 0
fi
[ -z "${target:-}" ] || [ ! -f "$target" ] && exit 0

# Get dimensions via `file` (works on Linux + macOS without extra deps).
dims=$(file "$target" 2>/dev/null | grep -oE '[0-9]+ x [0-9]+' | head -1)
w=$(echo "$dims" | awk '{print $1}')
h=$(echo "$dims" | awk '{print $3}')

# If `file` couldn't determine, try python+PIL as fallback (often available).
if [ -z "$w" ] || [ -z "$h" ]; then
  if command -v python3 >/dev/null 2>&1; then
    read w h < <(python3 -c "from PIL import Image; im=Image.open('$target'); print(im.size[0], im.size[1])" 2>/dev/null || echo "")
  fi
fi
[ -z "$w" ] || [ -z "$h" ] && exit 0

if [ "$w" -gt 8000 ] || [ "$h" -gt 8000 ]; then
  cat >&2 <<EOF
Screenshot $target is ${w}x${h}. Claude's image input rejects anything >8000px
on either side -- this is why the screenshot is unreadable.

Retry with ONE of:
  - browser_snapshot       (accessibility tree, no image, better for LLM analysis)
  - viewport screenshot    (omit fullPage:true; set viewport to 1920x1080 or less)
  - clip parameter         (clip: { x:0, y:0, width:1920, height:1080 })

Prefer browser_snapshot unless the user explicitly asked for a visual.
EOF
  exit 2
fi
exit 0
