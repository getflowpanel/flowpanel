# Realtime

FlowPanel ships a live-update pipeline built on PostgreSQL `LISTEN`/`NOTIFY`
(with a polling fallback). It's opt-in per resource and per widget.

## Server: opt in

```ts
import { defineResource } from "@flowpanel/core";

const userResource = defineResource<User>(users, {
  realtime: true, // <— on
  ...
});
```

When `realtime: true` is set, every successful mutation on the resource
(`create` / `update` / `delete` / row actions) writes one row to the
`flowpanel_events` table with:

- `event`: `resource.<key>` (e.g. `resource.user`)
- `data`: `{ op, id, actionId? }`

The SSE broker picks those rows up via `LISTEN` (when the adapter exposes
a `db.listen` method) or by polling every 2s (fallback) and fans them out
to all connected SSE clients.

Writes are fire-and-forget: a broker/DB failure is logged but never fails
the underlying mutation.

## Client: `useLive`

```tsx
import { useLive } from "@flowpanel/react";
import { useQueryClient } from "@tanstack/react-query";

function UsersPage() {
  const qc = useQueryClient();
  const { status } = useLive({
    channel: "resource.user",
    onEvent: () => qc.invalidateQueries({ queryKey: ["resource.list", "user"] }),
  });
  // status: "live" | "reconnecting" | "polling" | "paused"
  ...
}
```

The hook:

- Opens a shared `EventSource` to `/api/trpc/flowpanel.stream.connect`.
- Filters by the `channel` name — your callback only fires on matching events.
- Reconnects with exponential backoff; after `maxRetries` attempts it falls
  back to `"polling"` so your UI can show the degraded state.

## Channel naming

| Channel               | Fired by                         |
| --------------------- | -------------------------------- |
| `resource.<key>`      | Row changed (any mutation op).   |
| `widget.<id>`         | _(B8)_ Widget data invalidated.  |
| `run.created/finished/failed` | Pipeline-run lifecycle.   |
| `metrics.updated`     | Cross-cutting metrics refresh.   |

## Multi-process deployments

`LISTEN`/`NOTIFY` is cross-connection by design, so every Next.js process
receives every event. The broker de-duplicates by event id before fanning
out to its local SSE clients. No extra infrastructure required — as long
as every process talks to the same Postgres database.

## Guard

`flowpanel doctor` checks that the `flowpanel_events` table exists
(see `docs/reference/handler.md#flowpanel-doctor---boundary-check`). Run
the migration to create it before enabling realtime.
