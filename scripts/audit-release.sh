#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

search_pattern() {
  local pattern="$1"
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git grep -I -n -E "$pattern" -- . ':(exclude)scripts/audit-release.sh' 2>/dev/null || true
    return
  fi
  if ! command -v rg >/dev/null 2>&1; then
    echo "audit-release: git or rg is required" >&2
    exit 1
  fi
  rg -n --hidden -g '!node_modules/**' -g '!dist/**' \
    -g '!scripts/audit-release.sh' "$pattern" . 2>/dev/null || true
}

scan() {
  local label="$1"
  local pattern="$2"
  local output
  output="$(search_pattern "$pattern")"
  if [[ -n "$output" ]]; then
    echo "audit-release: ${label} candidate(s) found:" >&2
    printf '%s\n' "$output" | cut -d: -f1-2 | sort -u >&2
    return 1
  fi
}

failed=0
scan "private key" 'BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY' || failed=1
scan "GitHub token" 'gh[pousr]_[A-Za-z0-9_]{20,}' || failed=1
scan "common API token" '(sk|xai|api)[_-][A-Za-z0-9_-]{24,}' || failed=1
scan "JWT" 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' || failed=1
scan "personal macOS path" '/Users/[^ <]+' || failed=1
scan "personal Linux path" '/home/[^ <]+' || failed=1
scan "private IPv4 address" '(10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|192\.168\.[0-9]{1,3}\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3})' || failed=1
scan "DSH launch token" 'token=[A-Za-z0-9._~-]{12,}' || failed=1
scan "session identifier" 'session-[0-9a-f]{8}-[0-9a-f-]{20,}' || failed=1

if (( failed != 0 )); then
  echo "audit-release: failed" >&2
  exit 1
fi

echo "audit-release: no credential or personal-infrastructure pattern found"
