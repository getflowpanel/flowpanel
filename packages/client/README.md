# @flowpanel/client

Client-only hooks for FlowPanel — typed admin client, mutation helpers, optimistic updates.

[![npm](https://img.shields.io/npm/v/@flowpanel/client.svg)](https://www.npmjs.com/package/@flowpanel/client)

> Most users import from **`flowpanel/client`** (umbrella subpath).

## Hooks

- **`useAdminMutation(action, opts)`** — wraps a Server Action with `optimistic`, `rollbackOn`, `onSuccess`, `onError`.
- Re-exports `useLiveChannel` and other client hooks from `@flowpanel/react`.

## Bundle

Tiny — `flowpanel/client` is ≤ 25 KB brotli-compressed.

## Documentation

<https://flowpanel.dev>

## License

MIT
