# Technical documentation

## Purpose

`dsh-xai-oauth` is a thin UI and composition bridge. It does not implement the
xAI protocol, model adapter, OAuth token exchange, refresh logic, or credential
storage.

## Composition

The bundle patch:

1. mounts `@deepseek-ai/dsh-authorization`;
2. mounts this plugin;
3. enables the stock `xai` route on `@deepseek-ai/dsh-llm-pi-ai`.

The stock pi-ai integration registers xAI's device-code flow when the
authorization service is present. Successful authentication writes a grant to
the DSH credential record `llm-pi-ai/xai`.

## Host side

The host plugin injects only public DSH services:

- `authorization`;
- `connection`;
- `credentials`;
- `settings`.

It registers one authenticated Connection RPC channel,
`/dsh-xai-oauth`, with these logical operations:

- `status`;
- `begin`;
- `cancel`;
- `disconnect`;
- `repair-oauth`.

Every operation accepts an empty object. `begin` explicitly selects the OAuth
method. Status responses contain only safe metadata such as connection state,
credential kind, writability, API-key override state, and in-memory flow
notices. Credential values are never returned.

`repair-oauth` removes the `providers.xai.apiKeyEnv` setting and its writable
credential reference while preserving the OAuth grant.

## Client side

The browser module registers an extension in the keyed
`settings.models.provider-card` slot for `llm-pi-ai`. It renders only for the
`xai` provider.

The client calls the host through `ctx.connection.rpc`, so DSH applies its
browser session and same-origin trust boundary. Polling runs quickly only
during an active authorization flow, slows while idle, and pauses while the
document is hidden.

## Lifecycle

Authorization state is owned by DSH and pi-ai. The plugin keeps only transient
flow notices in memory. Unloading the plugin cancels any pending authorization
attempt and withdraws its RPC handler through Cordis effect ownership.

## Security invariants

- no raw `webServer` route;
- no standalone login page;
- no token or refresh-token serialization;
- no credential value in status or error responses;
- no cross-origin mutation path;
- no non-HTTPS authorization link rendered by the client;
- no DSH source modification.

## Tests

The test suite covers:

- safe status projection;
- OAuth method selection;
- API-key override repair while preserving the grant;
- read-only credential behavior;
- invalid payload handling;
- Connection-channel registration;
- concurrent authorization attempts;
- prompt cancellation and journal lifecycle.

Run:

```sh
pnpm verify
bash scripts/audit-release.sh
```
