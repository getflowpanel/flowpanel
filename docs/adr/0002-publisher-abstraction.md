# ADR 0002 — Publisher abstraction with memory + Redis drivers

**Status:** Accepted (M3 → frozen for 1.0)

## Context

Spec §13 requires realtime updates: a mutation in tab A should propagate
to tab B's open list. The natural transport is Server-Sent Events (SSE) on
the client side, but the server side has two cardinalities to support:

1. **Single-process / dev**: an in-memory pub/sub is enough. No Redis,
   no docker-compose, just `pnpm dev`.
2. **Multi-instance / prod**: messages must fan out across processes.
   Redis pub/sub is the standard choice; ioredis has the right surface.

A naïve approach binds directly to `ioredis` and falls back to a single
`Map<string, Set<Handler>>` when Redis is absent. That works but
intermixes transport detail with the publish API and fights tree-shaking
(ioredis pulls in node-only code that breaks edge bundlers).

## Decision

Define a thin `Publisher` interface and ship two drivers behind a single
factory:

```ts
// packages/core/src/runtime/publish.ts
export interface Publisher {
  publish(channel: string, payload?: unknown): Promise<void>;
  subscribe(channel: string, handler: (p: unknown) => void): () => void;
}

export type PublisherOptions =
  | { driver: "memory" }
  | { driver: "redis"; url: string; keyPrefix?: string };

export function createPublisher(opts: PublisherOptions): Publisher;
```

Users declare the driver in `defineAdmin({ realtime: { driver: "memory" } })`.
The Redis driver dynamic-imports `ioredis` so consumers without it pay no
cost (it's an optional peer dep).

The runtime singleton is bound idempotently per request via
`@flowpanel/next`'s `bindPublisher(config)`, called from every entry point
(server actions, drawer route, page render).

## Consequences

**Wins:**

- Dev experience: realtime works without any setup.
- Prod path: switch one config field, no code changes.
- Test isolation: unit tests use the memory driver; integration tests
  spin up a `testcontainers` Redis when needed.
- `ioredis` is an **optional** peer dep — the bundle stays clean for
  users who don't use realtime (or use only the memory driver).

**Costs / constraints:**

- Two drivers means two test paths. M3 ships `publish-redis.test.ts`
  with a real ioredis flush; the test occasionally flakes under
  `setTimeout(0)` timing.
- The `Publisher` type is part of the public API — the two-driver shape
  is locked in for 1.0. Adding a third driver (e.g., NATS, postgres
  LISTEN/NOTIFY) is a 1.x feature and an additive ADR.
- Redis driver loads `ioredis` indirectly (`const specifier = "ioredis";
  await import(specifier)`) so TypeScript doesn't statically resolve the
  module. This is intentional and documented in the file.

## References

- `packages/core/src/runtime/publish.ts` — both drivers.
- `packages/next/src/runtime/publish.ts` — request-bound singleton +
  `publishResource(name, event)` helper.
- `packages/next/src/stream.ts` — SSE broker that subscribes per channel.
- `packages/react/src/hooks/useLiveChannel.ts` — client EventSource
  consumer.
