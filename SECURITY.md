# Security policy

## Supported versions

Security fixes are applied to the latest release. Version 0.2.x is currently
supported with DeepSeek Harness 0.1.2-rc.1.

## Reporting a vulnerability

Do not open a public issue containing credentials, OAuth codes, launch URLs,
private infrastructure details, or exploit instructions against a live host.
Use GitHub's private vulnerability reporting feature on this repository.

Please include the plugin version, DSH version, operating system, a minimal
reproduction, and redacted logs.

## Security design

- OAuth grants remain in the DSH credential store.
- Tokens and refresh tokens are never returned to the browser UI.
- Browser actions use DSH's authenticated Connection RPC boundary.
- DSH enforces its session-cookie, Host, Origin, and cross-site request checks.
- Authorization notices are held in memory and are not written by this plugin.
- The plugin exposes no standalone HTTP page or unauthenticated mutation route.
- Authorization links are accepted by the UI only when they use HTTPS.

The plugin is unofficial and is not affiliated with xAI or DeepSeek.
