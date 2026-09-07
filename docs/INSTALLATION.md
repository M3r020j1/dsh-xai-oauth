# Installation

## Compatibility

| Component | Supported |
| --- | --- |
| DeepSeek Harness | 0.1.2-rc.1 |
| Node.js | 22.19 or newer |
| Package manager | pnpm 11 |
| DSH profile | Web |
| Host interface | Local browser or SSH tunnel |

The installer refuses an untested DSH version unless
`--allow-untested-dsh` is supplied. That option only bypasses the version
guard; it does not make an unsupported version compatible.

## Install from a repository checkout

```sh
git clone https://github.com/M3r020j1/dsh-xai-oauth.git
cd dsh-xai-oauth
bash ./scripts/install.sh
```

The installer:

1. verifies the DSH version and the package identity;
2. creates a timestamped backup under `~/.dsh/backups/`;
3. installs the plugin under `~/.dsh/local-plugins/dsh-xai-oauth`;
4. adds the plugin to the selected profile;
5. installs profile dependencies;
6. validates the composed DSH configuration;
7. restores the previous files automatically if a step fails.

To use a profile other than `web`:

```sh
bash ./scripts/install.sh --profile PROFILE_NAME
```

To install a downloaded release package:

```sh
bash ./scripts/install.sh --source /path/to/dsh-xai-oauth-VERSION.tgz
```

Restart DSH after installation:

```sh
dsh --profile web
```

## Authenticate

Open **Settings → Models → xAI**, then select **Connect with xAI**. Follow the
HTTPS authorization link, copy the displayed device code, and finish signing
in with xAI.

The normal DSH **Edit** button configures API-key authentication. Leave that
field empty when using OAuth. If an API-key setting shadows OAuth, the plugin
shows **Restore OAuth**.

## Headless host over SSH

Start DSH on the remote host:

```sh
dsh --profile web --no-open --port 3080
```

On the workstation, create a tunnel:

```sh
ssh -L 13080:127.0.0.1:3080 user@remote-host
```

DSH prints a private launch URL. Open the equivalent URL through
`http://127.0.0.1:13080` on the workstation, preserving its query string.
Never share or publish that launch URL. Complete the xAI device-code flow in
the workstation browser; the OAuth grant remains on the remote host.

## Update

Pull or download the new release, then run the installer again. It backs up and
replaces only this plugin:

```sh
git pull --ff-only
bash ./scripts/install.sh
```

## Uninstall

```sh
bash ./scripts/uninstall.sh
```

The uninstaller removes the plugin from the profile and moves its installed
files into a timestamped backup. It does not delete an OAuth grant. Disconnect
from xAI in DSH first if the grant should also be removed.
