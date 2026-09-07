#!/usr/bin/env bash
set -euo pipefail

plugin_name="dsh-xai-oauth"
profile_name="web"
pnpm_bin="${PNPM_BIN:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/uninstall.sh [--profile NAME] [--pnpm-bin PATH]

The installed plugin is moved to a timestamped backup. OAuth credentials are
not deleted; disconnect in DSH first if the grant should be removed.
EOF
}

while (($#)); do
  case "$1" in
    --profile)
      profile_name="${2:?missing profile name}"
      shift 2
      ;;
    --pnpm-bin)
      pnpm_bin="${2:?missing pnpm path}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "uninstall: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ! "$profile_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "uninstall: invalid profile name" >&2
  exit 2
fi

user_home="${HOME:?HOME is required}"
dsh_root="${DSH_HOME:-$user_home/.dsh}"
profile_dir="$dsh_root/profiles/$profile_name"
plugin_dir="$dsh_root/local-plugins/$plugin_name"
backup_dir="$dsh_root/backups/dsh-xai-oauth-uninstall-$(date +%Y%m%d-%H%M%S)"

if [[ -z "$pnpm_bin" ]]; then
  if [[ -x "$user_home/.local/node_modules/.bin/pnpm" ]]; then
    pnpm_bin="$user_home/.local/node_modules/.bin/pnpm"
  else
    pnpm_bin="$(command -v pnpm || true)"
  fi
fi
if [[ ! -x "$pnpm_bin" ]]; then
  echo "uninstall: pnpm not found; use --pnpm-bin" >&2
  exit 1
fi
if [[ ! -f "$profile_dir/package.json" ]]; then
  echo "uninstall: profile not found: $profile_dir" >&2
  exit 1
fi

mkdir -p "$backup_dir/profile"
chmod 700 "$backup_dir"
cp -p "$profile_dir/package.json" "$backup_dir/profile/package.json"
if [[ -f "$profile_dir/pnpm-lock.yaml" ]]; then
  cp -p "$profile_dir/pnpm-lock.yaml" "$backup_dir/profile/pnpm-lock.yaml"
fi
if [[ -d "$plugin_dir" ]]; then
  mv "$plugin_dir" "$backup_dir/plugin"
fi

rollback() {
  status=$?
  trap - ERR INT TERM
  echo "uninstall: failed; restoring the previous profile" >&2
  cp -p "$backup_dir/profile/package.json" "$profile_dir/package.json"
  if [[ -f "$backup_dir/profile/pnpm-lock.yaml" ]]; then
    cp -p "$backup_dir/profile/pnpm-lock.yaml" "$profile_dir/pnpm-lock.yaml"
  fi
  if [[ -d "$backup_dir/plugin" && ! -e "$plugin_dir" ]]; then
    mv "$backup_dir/plugin" "$plugin_dir"
  fi
  exit "$status"
}
trap rollback ERR INT TERM

node -e '
  const fs = require("node:fs")
  const file = process.argv[1]
  const pluginName = process.argv[2]
  const value = JSON.parse(fs.readFileSync(file, "utf8"))
  if (value.dependencies) delete value.dependencies[pluginName]
  const bundles = value.dsh?.profile?.bundles
  if (Array.isArray(bundles)) {
    value.dsh.profile.bundles = bundles.filter((name) => name !== pluginName)
  }
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
' "$profile_dir/package.json" "$plugin_name"

"$pnpm_bin" --dir "$profile_dir" install --frozen-lockfile=false
trap - ERR INT TERM
echo "Uninstalled $plugin_name from profile $profile_name."
echo "Recoverable backup: $backup_dir"
