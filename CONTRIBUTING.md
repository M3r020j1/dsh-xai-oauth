# Contributing

Thank you for helping improve `dsh-xai-oauth`.

## Development setup

Requirements:

- Node.js 22.19 or newer;
- pnpm 11;
- DeepSeek Harness 0.1.2-rc.1 for integration testing.

Install dependencies and run the complete verification:

```sh
pnpm install --frozen-lockfile
pnpm verify
bash scripts/audit-release.sh
```

Do not commit DSH profiles, credential stores, logs, OAuth notices, launch
URLs, API keys, tokens, private host names, private IP addresses, or absolute
home-directory paths. Use synthetic fixtures in tests.

Changes to authentication, credential deletion, settings mutation, or RPC
transport require tests for the success path and the failure/read-only path.
Integration claims must include a clean-profile boot and a real model request.
