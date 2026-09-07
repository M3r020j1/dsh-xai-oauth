#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pnpm_bin="$(command -v pnpm)"
fixture_dir="$(mktemp -d "${TMPDIR:-/tmp}/dsh-xai-oauth-smoke.XXXXXX")"
dsh_root="$fixture_dir/dsh"
profile_dir="$dsh_root/profiles/web"
fake_dsh="$fixture_dir/fake-dsh"

cleanup() {
  rm -rf -- "$fixture_dir"
}
trap cleanup EXIT

mkdir -p "$profile_dir"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "${1:-}" == "--version" ]]; then' \
  '  echo "0.1.2-rc.1"' \
  '  exit 0' \
  'fi' \
  'if [[ "${1:-}" == "--profile" && "${3:-}" == "--dump-config" ]]; then' \
  '  echo "name: dsh-xai-oauth"' \
  '  exit 0' \
  'fi' \
  'exit 2' >"$fake_dsh"
chmod 700 "$fake_dsh"

printf '%s\n' \
  '{' \
  '  "name": "dsh-profile-smoke",' \
  '  "private": true,' \
  '  "dependencies": {},' \
  '  "dsh": {' \
  '    "profile": {' \
  '      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"]' \
  '    }' \
  '  }' \
  '}' >"$profile_dir/package.json"

DSH_HOME="$dsh_root" bash "$repo_dir/scripts/install.sh" \
  --dsh-bin "$fake_dsh" \
  --pnpm-bin "$pnpm_bin"

node -e '
  const p = require(process.argv[1])
  if (!p.dependencies["dsh-xai-oauth"]) process.exit(1)
  if (!p.dsh.profile.bundles.includes("dsh-xai-oauth")) process.exit(1)
' "$profile_dir/package.json"
node -e '
  const p = require(process.argv[1])
  if (p.name !== "dsh-xai-oauth" || p.version !== "0.2.0") process.exit(1)
' "$dsh_root/local-plugins/dsh-xai-oauth/package.json"

DSH_HOME="$dsh_root" bash "$repo_dir/scripts/uninstall.sh" \
  --pnpm-bin "$pnpm_bin"

node -e '
  const p = require(process.argv[1])
  if (p.dependencies["dsh-xai-oauth"]) process.exit(1)
  if (p.dsh.profile.bundles.includes("dsh-xai-oauth")) process.exit(1)
' "$profile_dir/package.json"
test ! -e "$dsh_root/local-plugins/dsh-xai-oauth"

echo "install-smoke: install and uninstall passed"
