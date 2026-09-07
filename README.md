# dsh-xai-oauth

Unofficial, update-safe xAI OAuth integration for DeepSeek Harness (DSH).
It uses public DSH extension points and never modifies the DSH source.

> This community project is not affiliated with xAI or DeepSeek.

## Features

- xAI device-code OAuth directly under **Settings → Models → xAI**;
- Grok models through DSH's stock `llm-pi-ai` provider;
- OAuth grant storage and refresh through the DSH credential vault;
- authenticated, same-origin Connection RPC for every browser action;
- remote/headless authentication through an SSH tunnel;
- detection and repair of API-key settings that shadow OAuth;
- no token, API key, OAuth code, profile, or personal host data in the package.

## Compatibility

The currently tested combination is:

| Component | Version |
| --- | --- |
| DeepSeek Harness | 0.1.2-rc.1 |
| Plugin | 0.2.0 |
| Node.js | 22.19 or newer |
| pnpm | 11 |

New DSH releases should be considered untested until the clean-profile,
security, and real model-request checks have passed.

## Quick installation

From a repository checkout:

```sh
bash ./scripts/install.sh
```

The installer validates compatibility, backs up the selected DSH profile,
installs the plugin, updates the profile, and checks the final composition. It
automatically restores the previous profile if installation fails.

Restart DSH, open **Settings → Models → xAI**, and choose
**Connect with xAI**.

See the complete [installation guide](docs/INSTALLATION.md), including remote
VMs without a browser, and the [user guide](docs/USER_GUIDE.md).

## Documentation

- [Installation, update, and removal](docs/INSTALLATION.md)
- [User guide and troubleshooting](docs/USER_GUIDE.md)
- [Technical architecture](docs/TECHNICAL.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Security summary

The plugin has no standalone HTTP page and no unauthenticated mutation route.
OAuth and refresh tokens remain inside DSH/pi-ai. The browser receives only
safe status metadata and transient device-flow notices. DSH's own session,
Host, Origin, and cross-site checks protect plugin operations.

## Development

```sh
pnpm install --frozen-lockfile
pnpm verify
bash scripts/audit-release.sh
```
