#!/bin/bash
# Resize any PNG/JPG exceeding 1800px in either dimension.
# Uses macOS sips (built-in, no deps).
# Usage: ./scripts/resize-screenshot.sh path/to/image.png
#        ./scripts/resize-screenshot.sh path/to/dir/   (resizes all PNGs in dir)

MAX=1800

resize_one() {
  local f="$1"
  local w h scale nw nh
  w=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$f" 2>/dev/null | awk '/pixelHeight/{print $2}')
  [ -z "$w" ] || [ -z "$h" ] && return
  if [ "$w" -gt "$MAX" ] || [ "$h" -gt "$MAX" ]; then
    # Use python for float math (always available on macOS)
    read nw nh <<< $(python3 -c "
import math
w,h,m=$w,$h,$MAX
s=min(m/w,m/h)
print(round(w*s),round(h*s))
")
    sips --resampleHeightWidth "$nh" "$nw" "$f" >/dev/null 2>&1
    echo "Resized $f: ${w}x${h} → ${nw}x${nh}"
  fi
}

if [ -d "$1" ]; then
  for f in "$1"/*.png "$1"/*.jpg; do
    [ -f "$f" ] && resize_one "$f"
  done
elif [ -f "$1" ]; then
  resize_one "$1"
else
  echo "Usage: $0 <file.png|directory/>"
  exit 1
fi
