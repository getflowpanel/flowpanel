# Realtime

FlowPanel ships a live-update pipeline on PostgreSQL. **Two modes:**

| Mode | Latency | Setup | Note |
| ---- | ------- | ----- | ---- |
| `LISTEN`/`NOTIFY` | < 50ms | pass `listen:` to the adapter | Recommended. |
| Polling fallback | 2s | nothing | Automatic. FlowPanel logs a one-time warning at startup. |

Both write to the same `flowpanel_events` table — the difference is only
how the SSE broker learns that a new row has landed.

## Server: opt in per resource

```ts
import { resource } from "flowpanel";

const userResource = resource(users, {
  realtime: true, // ← on
  ...
});
```

Every successful mutation (`create` / `update` / `delete` / row action)
now publishes `resource.<key>` with `{ op, id, actionId? }` payload. Writes
are fire-and-forget — a broker/DB failure never affects the underlying
mutation.

## Wire LISTEN for sub-50ms updates

### Drizzle + postgres.js

```ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const sql = postgres(process.env.DATABASE_URL!);

export const adapter = drizzleAdapter({
  db: drizzle(sql, { schema }),
  schema,
  listen: async (channel, handler) => {
    const sub = await sql.listen(channel, handler);
    return () => sub.unlisten();
  },
});
```

### Drizzle + pg

```ts
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Dedicated client for LISTEN — pool connections get recycled.
const listenClient = new Client({ connectionString: process.env.DATABASE_URL });
await listenClient.connect();

export const adapter = drizzleAdapter({
  db: drizzle(pool),
  schema,
  listen: async (channel, handler) => {
    listenClient.on("notification", (msg) => {
      if (msg.channel === channel && msg.payload) handler(msg.payload);
    });
    await listenClient.query(`LISTEN ${channel}`);
    return async () => {
      await listenClient.query(`UNLISTEN ${channel}`);
    };
  },
});
```

### Prisma

Prisma doesn't expose LISTEN — use a sidecar `pg.Client`:

```ts
import { Client } from "pg";

const listenClient = new Client({ connectionString: process.env.DATABASE_URL });
await listenClient.connect();

export const adapter = prismaAdapter({
  prisma,
  listen: async (channel, handler) => {
    listenClient.on("notification", (msg) => {
      if (msg.channel === channel && msg.payload) handler(msg.payload);
    });
    await listenClient.query(`LISTEN ${channel}`);
    return async () => { await listenClient.query(`UNLISTEN ${channel}`); };
  },
});
```

## Check your setup

```
$ pnpm flowpanel doctor
  ✓ Realtime  LISTEN/NOTIFY wired — sub-50ms updates
```

If you see:

```
  ✗ Realtime  realtime: true set but adapter has no listen: option — 2s polling fallback
```

you're on polling. Admin still works; just 2s lag instead of 50ms.

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
}
```

## Channel naming

| Channel | Fired by |
| ------- | -------- |
| `resource.<key>` | Row changed (any mutation op). |
| `run.created/finished/failed` | Pipeline-run lifecycle. |
| `metrics.updated` | Cross-cutting metrics refresh. |

## Multi-process deployments

`LISTEN`/`NOTIFY` is cross-connection by design — every Next.js worker
receives every event. The broker de-duplicates by event id before fanning
out to its local SSE clients. No Redis / no coordinator required, as long
as every process talks to the same Postgres.
