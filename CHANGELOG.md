# Changelog

All notable changes to this project are documented here.

## 0.2.14 - 2026-10-09

- Hide the one-time OAuth device code and authorization link after a successful
  Connect, so the Models card no longer keeps a stale login challenge on screen.
- Confirmed support matrix for this release: DeepSeek Harness 0.1.2-rc.1 through
  0.1.5-rc.3, and 0.2.0-rc.2, on Node.js 22.19+ with the existing installer
  compatibility guard.

## 0.2.13 - 2026-10-09

- Read plugin settings through DSH 0.2 `settings.describe()` while keeping the
  older `settings.get()` path for 0.1.x profiles.
- Cancel a stuck in-flight xAI authorization before starting a new Connect
  attempt, so a failed browser handoff can be retried cleanly.

## 0.2.12 - 2026-10-09

- Widen DSH peer dependency ranges to include the 0.2.x runtime line.
- Extend the installer compatibility guard to DeepSeek Harness 0.2.0-rc.2.

## 0.2.11 - 2026-09-18

- Allow the Host bundle to import declared DSH peer packages such as
  `@deepseek-ai/dsh-typert-protocol`, which are provided by the DSH profile at
  runtime.
- Keep undeclared `@deepseek-ai/*` runtime imports rejected by the package
  check so accidental coupling still fails CI.

## 0.2.10 - 2026-09-18

- Drop hard Host dependencies on `connection` and `webServer` so headless
  profiles can activate the xAI OAuth composition without a Web transport.
- Keep Typert Remote registration for DSH Web profiles that already provide
  those services through the normal Web stack.

## 0.2.9 - 2026-09-18

- Make the Host `connection` and `webServer` injects optional so the plugin can
  activate on headless profiles while still waiting for them on DSH Web.
- Keep the DSH 0.1.5-rc.2 installer guard and local-mirror refresh behavior.

## 0.2.8 - 2026-09-18

- Extend the installer compatibility guard to DeepSeek Harness 0.1.5-rc.2.
- Keep the validated Typert Remote Host path and local-mirror refresh from
  0.2.7 unchanged.

## 0.2.7 - 2026-09-15

- Declare the Connection and Web server dependencies required by DSH's Typert
  Remote gateway, restoring full Web-profile startup on DSH 0.1.5.
- Force refresh of the profile's local package link during installation, so an
  upgrade cannot retain a stale plugin copy in `node_modules`.
- Replace only the installed plugin mirror after dependency resolution, closing
  pnpm's remaining directory-link cache path.

## 0.2.3 - 2026-09-15

- Move the OAuth panel onto DSH's native `/api` Typert Remote gateway.
- Remove the dedicated `/dsh-xai-oauth` HTTP channel that returned HTTP 405
  under DSH 0.1.5's static router.

## 0.2.2 - 2026-09-15

- Fix the DSH Web Settings regression in 0.2.1: the plugin no longer
  registers on DSH's reserved shared `/api` gateway.
- Register the OAuth controls on their own authenticated DSH Connection
  channel after the Web server is available, preserving native Models,
  Plugins, and Agent presets routes.

## 0.2.1 - 2026-09-15

- Restore startup compatibility with DeepSeek Harness 0.1.5 by moving the
  plugin methods to DSH Connection's authenticated shared `/api` channel.
- Keep the RPC transport and OAuth credential boundary unchanged.
- Make the Host bundle self-contained so release installations do not depend
  on development packages beside the plugin.
- Validate dependencies against the DSH 0.1.5-rc.2 component set.
- Extend the installer compatibility guard to DSH 0.1.5-rc.1 while retaining
  DSH 0.1.2-rc.1 support.

## 0.2.0 - 2026-09-07

- Integrate OAuth controls into the native xAI model card.
- Replace raw HTTP routes with an authenticated DSH Connection RPC channel.
- Reject unauthenticated and cross-site requests through DSH's trust boundary.
- Remove the standalone test page.
- Add safe OAuth repair when an API-key override shadows the OAuth grant.
- Add conditional polling, device-code copy, HTTPS link validation, and
  English/Chinese localization.
- Add lifecycle, read-only credential, cancellation, and RPC tests.
