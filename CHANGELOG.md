# Changelog

All notable changes to this project are documented here.

## 0.2.0 - 2026-09-07

- Integrate OAuth controls into the native xAI model card.
- Replace raw HTTP routes with an authenticated DSH Connection RPC channel.
- Reject unauthenticated and cross-site requests through DSH's trust boundary.
- Remove the standalone test page.
- Add safe OAuth repair when an API-key override shadows the OAuth grant.
- Add conditional polling, device-code copy, HTTPS link validation, and
  English/Chinese localization.
- Add lifecycle, read-only credential, cancellation, and RPC tests.
