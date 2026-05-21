#!/usr/bin/env bash
# PostToolUse on Write|Edit|MultiEdit.
# Detects imports of packages NOT listed in package.json / requirements.txt /
# pyproject.toml and warns Claude. This is how you catch hallucinated APIs
# before they bite you in production.
set -euo pipefail

INPUT=$(cat)
path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
[ -z "$path" ] || [ ! -f "$path" ] && exit 0

check_js() {
  [ -f package.json ] || return 0
  imports=$(grep -hoE "(import[[:space:]]+[^'\"]+from[[:space:]]+|require\()['\"][^.][^'\"]+['\"]" "$path" 2>/dev/null \
            | grep -oE "['\"][^'\"]+['\"]" | tr -d "'\"" | awk -F/ '/^@/{print $1"/"$2; next} {print $1}' \
            | sort -u || true)
  [ -z "$imports" ] && return 0

  deps=$(jq -r '((.dependencies//{}) + (.devDependencies//{}) + (.peerDependencies//{}) + (.optionalDependencies//{})) | keys[]' \
         package.json 2>/dev/null || true)
  builtins='^(fs|path|os|crypto|http|https|url|stream|buffer|child_process|events|util|net|dns|tls|assert|zlib|querystring|readline|cluster|process|timers|worker_threads|perf_hooks|node:.*|bun:.*)$'

  missing=""
  while IFS= read -r imp; do
    [ -z "$imp" ] && continue
    echo "$imp" | grep -qE "$builtins" && continue
    echo "$deps" | grep -qFx "$imp" && continue
    missing="${missing}  - $imp\n"
  done <<< "$imports"

  if [ -n "$missing" ]; then
    cat >&2 <<EOF
WARNING: '$path' imports packages not declared in package.json:

$(printf "%b" "$missing")
If these are real packages, install them now:
  npm i <pkg>   (or pnpm/yarn/bun equivalent)

If you invented them, REMOVE the imports. Do not assume package names from
memory -- verify on npm or read installed source.
EOF
    return 2
  fi
  return 0
}

check_py() {
  manifest=""
  [ -f requirements.txt ] && manifest="requirements.txt"
  [ -f pyproject.toml ] && manifest="${manifest:+$manifest } pyproject.toml"
  [ -z "$manifest" ] && return 0

  imports=$(grep -hE '^[[:space:]]*(from|import)[[:space:]]+[a-zA-Z_]' "$path" 2>/dev/null \
            | sed -E 's/^[[:space:]]*(from|import)[[:space:]]+([a-zA-Z0-9_]+).*/\2/' \
            | sort -u || true)
  [ -z "$imports" ] && return 0

  # Build a permissive "is-declared" set: package names mentioned anywhere in manifests.
  declared=$(cat $manifest 2>/dev/null | tr '[:upper:]' '[:lower:]' || true)
  # Python stdlib (partial; common ones).
  stdlib='^(abc|argparse|asyncio|base64|collections|configparser|contextlib|copy|csv|ctypes|dataclasses|datetime|decimal|email|enum|errno|fnmatch|functools|getopt|getpass|glob|gzip|hashlib|heapq|hmac|html|http|importlib|inspect|io|ipaddress|itertools|json|logging|math|multiprocessing|operator|os|pathlib|pickle|platform|pprint|queue|random|re|secrets|shlex|shutil|signal|socket|sqlite3|ssl|stat|string|struct|subprocess|sys|tempfile|textwrap|threading|time|timeit|tomllib|traceback|types|typing|unicodedata|unittest|urllib|uuid|venv|warnings|weakref|xml|zipfile|zlib|__future__)$'

  missing=""
  while IFS= read -r imp; do
    [ -z "$imp" ] && continue
    lc=$(echo "$imp" | tr '[:upper:]' '[:lower:]')
    echo "$lc" | grep -qE "$stdlib" && continue
    # Replace _ with - for PyPI naming match
    alt=$(echo "$lc" | tr '_' '-')
    echo "$declared" | grep -qE "(^|[[:space:]\"'=<>,])($lc|$alt)([[:space:]\"'=<>,]|$)" && continue
    missing="${missing}  - $imp\n"
  done <<< "$imports"

  if [ -n "$missing" ]; then
    cat >&2 <<EOF
WARNING: '$path' imports modules not found in $manifest:

$(printf "%b" "$missing")
Add them to requirements/pyproject if real, or remove if hallucinated.
EOF
    return 2
  fi
  return 0
}

case "$path" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs) check_js; exit $? ;;
  *.py)                              check_py; exit $? ;;
esac
exit 0
