# Changelog

All notable changes to this project are documented here.

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
