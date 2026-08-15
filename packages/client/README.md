# @flowpanel/client

Client-only hooks for FlowPanel — typed admin client, mutation helpers.

[![npm](https://img.shields.io/npm/v/@flowpanel/client.svg)](https://www.npmjs.com/package/@flowpanel/client)

> Most users import from **`@flowpanel/kit/client`** (umbrella subpath).

## Hooks

- **`useAdminMutation(action, opts)`** — wraps a Server Action with `rollbackOn`, `onSuccess`, `onError`.
- For optimistic updates, use `useOptimisticAction` from `@flowpanel/kit/react` (`@flowpanel/react`).
- Realtime hooks (`useLiveChannel`, `useRealtimeRefresh`, …) live in `@flowpanel/kit/react` (`@flowpanel/react`) — this package does not re-export them.

## Bundle

Tiny — `@flowpanel/kit/client` is ≤ 25 KB brotli-compressed.

## Documentation

<https://flowpanel.tech>

## License

MIT
