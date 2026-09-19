---
"@flowpanel/core": minor
"@flowpanel/kit": minor
"@flowpanel/next": patch
---

A worker can publish a realtime event without importing the admin. `@flowpanel/kit/publish`
(and `@flowpanel/core/publish`) exports `createPublisher({ redis })`, which takes a connection
string or an `ioredis`-compatible client you already configured and returns `publish`,
`channelFor` and `close`. It needs no `AdminConfig`, no adapter and no Next.js, so a cron job,
a queue processor or a one-off script publishes the same bytes the browser already knows how
to route. `bindPublisher(config)` in a worker was the old answer; it asked a publish-only
process to construct the whole admin to reach one Redis channel.

A publish-only process now opens one connection instead of two. The subscriber connection is
created on the first `subscribe`, by `duplicate()` when a client was supplied and otherwise as
a second connection, because a subscribed Redis connection can run no other command. Every
connection gets an `error` listener: an unhandled `error` on a Redis connection is what takes
a Node process down, and the listener logs one line per error kind rather than one per
reconnect attempt, and never rethrows. `close()` releases what the publisher opened and leaves
a client you passed in alone. Nothing connects until the first publish or subscribe, so
`defineAdmin` stays pure.

`realtime` accepts `client` alongside `url`, and requires one of the two with an error that
says so instead of failing at connect time. The Redis wire is unchanged from 0.2 — the body is the
payload as JSON and the channel is `<keyPrefix>:<channel>` — so a worker on 0.3 and an instance on
0.2 still reach each other. What changed is that the SSE frame's `{channel, payload}` envelope has
one owner, exported as `encodeEnvelope` / `decodeEnvelope`, and the browser bus decodes through it
rather than a second copy of the same rule. A payload is serialized before delivery in every
driver, so the memory driver behaves the way Redis will — a `Date` arrives as an ISO string in
development too, and a payload that cannot be JSON-encoded fails the same way with or without a
subscriber, naming the channel and the reason instead of raising a bare `TypeError`.

`bindPublisher` rebinds when the resolved options change — including a `client` that is a
different instance than the bound one — closing the publisher it replaces, so an HMR edit to
`realtime` takes effect without restarting the dev server. It still refuses to rebind on config
object identity alone: Next.js hands the same logical config to every route bundle as a different
object, and rebinding there orphaned subscribers that were already connected. A closed publisher
stays closed — `subscribe` opens no connection and returns a no-op disposer, and `publish` says it
is closed rather than resolving into nothing.

Binding warns once per process when the driver resolves to `memory` while `REDIS_URL` or
`FLOWPANEL_REDIS_URL` is set. That is the one realtime misconfiguration that looks entirely
healthy: every publish succeeds, the tab that made the change refreshes, and no other instance
or tab ever hears about it.
