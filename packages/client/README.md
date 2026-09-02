# @flowpanel/client

Client-only helpers for FlowPanel — typed admin client, mutation hook.

[![npm](https://img.shields.io/npm/v/@flowpanel/client.svg)](https://www.npmjs.com/package/@flowpanel/client)

> Most users import from **`@flowpanel/kit/client`** (umbrella subpath).

## Hooks

- **`useAdminMutation(action, opts)`** — wraps an async action returning `ActionResult`; exposes `run`, `pending`, `error`, `reset`, plus `onSuccess` / `onError` callbacks.
- For optimistic updates, use `useOptimisticAction` from `@flowpanel/kit/react` (`@flowpanel/react`).
- Realtime hooks (`useLiveChannel`, `useRealtimeRefresh`, …) live in `@flowpanel/kit/react` (`@flowpanel/react`) — this package does not re-export them.

## Typed admin client

`createFlowpanelClient(metadata)` returns a `FlowpanelClient` whose
`resource<Row>(name)` gives typed `list` / `get` / `create` / `update` /
`delete` calls against the FlowPanel API routes. Every call resolves to a
`FlowpanelResult`; narrow failures with `isFlowpanelErrorResult`:

```ts
import { createFlowpanelClient, isFlowpanelErrorResult } from "@flowpanel/kit/client";

const client = createFlowpanelClient(metadata);
const users = client.resource<{ id: string; email: string }>("users");

const res = await users.list({ page: 1, search: "ada" });
if (isFlowpanelErrorResult(res)) {
  console.error(res.error.code, res.error.message);
} else {
  console.log(res.data.rows);
}
```

## Bundle

Tiny — `@flowpanel/kit/client` is ≤ 25 KB brotli-compressed.

## Documentation

<https://flowpanel.tech>

## License

MIT
