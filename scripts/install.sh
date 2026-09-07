#!/usr/bin/env bash
set -euo pipefail

plugin_name="dsh-xai-oauth"
plugin_version="0.2.0"
tested_dsh_version="0.1.2-rc.1"
profile_name="web"
source_path=""
dsh_bin="${DSH_BIN:-}"
pnpm_bin="${PNPM_BIN:-}"
allow_untested=0

usage() {
  cat <<'EOF'
Usage: ./scripts/install.sh [options]

Options:
  --profile NAME          DSH profile to modify (default: web)
  --source PATH           Repository directory or release .tgz
  --dsh-bin PATH          DSH launcher to use
  --pnpm-bin PATH         pnpm executable to use
  --allow-untested-dsh    Bypass the exact DSH compatibility guard
  -h, --help              Show this help
EOF
}

while (($#)); do
  case "$1" in
    --profile)
      profile_name="${2:?missing profile name}"
      shift 2
      ;;
    --source)
      source_path="${2:?missing source path}"
      shift 2
      ;;
    --dsh-bin)
      dsh_bin="${2:?missing DSH path}"
      shift 2
      ;;
    --pnpm-bin)
      pnpm_bin="${2:?missing pnpm path}"
      shift 2
      ;;
    --allow-untested-dsh)
      allow_untested=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "install: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ! "$profile_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "install: invalid profile name" >&2
  exit 2
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_path="${source_path:-$repo_dir}"
user_home="${HOME:?HOME is required}"
dsh_root="${DSH_HOME:-$user_home/.dsh}"
profile_dir="$dsh_root/profiles/$profile_name"
plugin_parent="$dsh_root/local-plugins"
plugin_dir="$plugin_parent/$plugin_name"

if [[ -z "$dsh_bin" ]]; then
  if [[ -x "$user_home/.local/bin/dsh" ]]; then
    dsh_bin="$user_home/.local/bin/dsh"
  else
    dsh_bin="$(command -v dsh || true)"
  fi
fi
if [[ -z "$pnpm_bin" ]]; then
  if [[ -x "$user_home/.local/node_modules/.bin/pnpm" ]]; then
    pnpm_bin="$user_home/.local/node_modules/.bin/pnpm"
  else
    pnpm_bin="$(command -v pnpm || true)"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "install: Node.js not found" >&2
  exit 1
fi
if [[ ! -x "$dsh_bin" ]]; then
  echo "install: DSH launcher not found; use --dsh-bin" >&2
  exit 1
fi
if [[ ! -x "$pnpm_bin" ]]; then
  echo "install: pnpm not found; use --pnpm-bin" >&2
  exit 1
fi
if [[ ! -f "$profile_dir/package.json" ]]; then
  echo "install: DSH profile not found: $profile_dir" >&2
  exit 1
fi

active_dsh_version="$("$dsh_bin" --version | tr -d '[:space:]')"
if [[ "$active_dsh_version" != "$tested_dsh_version" && "$allow_untested" -ne 1 ]]; then
  echo "install: DSH $active_dsh_version is not tested; expected $tested_dsh_version" >&2
  echo "Use --allow-untested-dsh only after compatibility testing." >&2
  exit 1
fi

mkdir -p "$plugin_parent" "$dsh_root/backups"
stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/dsh-xai-oauth-install.XXXXXX")"
new_plugin_dir="$(mktemp -d "$plugin_parent/.dsh-xai-oauth.new.XXXXXX")"
backup_dir="$dsh_root/backups/dsh-xai-oauth-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir/profile"
chmod 700 "$backup_dir" "$new_plugin_dir"

cleanup() {
  rm -rf -- "$stage_dir" "$new_plugin_dir"
}

rollback() {
  status=$?
  trap - ERR INT TERM
  echo "install: failed; restoring the previous profile" >&2
  if [[ -f "$backup_dir/profile/package.json" ]]; then
    cp -p "$backup_dir/profile/package.json" "$profile_dir/package.json"
  fi
  if [[ -f "$backup_dir/profile/pnpm-lock.yaml" ]]; then
    cp -p "$backup_dir/profile/pnpm-lock.yaml" "$profile_dir/pnpm-lock.yaml"
  fi
  if [[ -d "$backup_dir/plugin" ]]; then
    rm -rf -- "$plugin_dir"
    cp -a "$backup_dir/plugin" "$plugin_dir"
  elif [[ -d "$plugin_dir" ]]; then
    rm -rf -- "$plugin_dir"
  fi
  cleanup
  exit "$status"
}
trap rollback ERR INT TERM

cp -p "$profile_dir/package.json" "$backup_dir/profile/package.json"
if [[ -f "$profile_dir/pnpm-lock.yaml" ]]; then
  cp -p "$profile_dir/pnpm-lock.yaml" "$backup_dir/profile/pnpm-lock.yaml"
fi
if [[ -d "$plugin_dir" ]]; then
  cp -a "$plugin_dir" "$backup_dir/plugin"
fi

package_file=""
if [[ -d "$source_path" ]]; then
  "$pnpm_bin" --dir "$source_path" pack --pack-destination "$stage_dir" >/dev/null
  package_file="$stage_dir/$plugin_name-$plugin_version.tgz"
elif [[ -f "$source_path" && "$source_path" == *.tgz ]]; then
  package_file="$source_path"
else
  echo "install: source must be a repository directory or .tgz file" >&2
  false
fi

if [[ ! -f "$package_file" ]]; then
  echo "install: package was not produced: $package_file" >&2
  false
fi
unsafe_archive=0
while IFS= read -r entry; do
  if [[ "$entry" != "package" && "$entry" != package/* ]]; then
    unsafe_archive=1
  fi
  if [[ "/$entry/" == *"/../"* || "/$entry/" == *"/./"* || "$entry" == /* ]]; then
    unsafe_archive=1
  fi
done < <(tar -tzf "$package_file")
if (( unsafe_archive != 0 )); then
  echo "install: unsafe package layout" >&2
  false
fi

tar -xzf "$package_file" -C "$new_plugin_dir" --strip-components=1
installed_identity="$(node -e '
  const p = require(process.argv[1])
  process.stdout.write(`${p.name}@${p.version}`)
' "$new_plugin_dir/package.json")"
if [[ "$installed_identity" != "$plugin_name@$plugin_version" ]]; then
  echo "install: unexpected package identity: $installed_identity" >&2
  false
fi
node -e '
  const fs = require("node:fs")
  const path = require("node:path")
  const root = fs.realpathSync(process.argv[1])
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const candidate = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) {
        const target = fs.realpathSync(candidate)
        if (target !== root && !target.startsWith(`${root}${path.sep}`)) process.exit(1)
      } else if (entry.isDirectory()) {
        visit(candidate)
      }
    }
  }
  visit(root)
' "$new_plugin_dir"

rm -rf -- "$plugin_dir"
mv "$new_plugin_dir" "$plugin_dir"
new_plugin_dir="$plugin_parent/.dsh-xai-oauth.consumed"

node -e '
  const fs = require("node:fs")
  const file = process.argv[1]
  const pluginDir = process.argv[2]
  const pluginName = process.argv[3]
  const value = JSON.parse(fs.readFileSync(file, "utf8"))
  value.dependencies ??= {}
  value.dependencies[pluginName] = `file:${pluginDir}`
  value.dsh ??= {}
  value.dsh.profile ??= {}
  value.dsh.profile.bundles ??= []
  if (!value.dsh.profile.bundles.includes(pluginName)) {
    value.dsh.profile.bundles.push(pluginName)
  }
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
' "$profile_dir/package.json" "$plugin_dir" "$plugin_name"

"$pnpm_bin" --dir "$profile_dir" install --frozen-lockfile=false
"$dsh_bin" --profile "$profile_name" --dump-config >"$stage_dir/composed.yml"
if ! grep -q "$plugin_name" "$stage_dir/composed.yml"; then
  echo "install: composed profile does not contain $plugin_name" >&2
  false
fi

trap - ERR INT TERM
cleanup
echo "Installed $plugin_name@$plugin_version for DSH $active_dsh_version."
echo "Backup: $backup_dir"
echo "Restart DSH, then authenticate under Settings > Models > xAI."
