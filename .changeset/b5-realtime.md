---
"@flowpanel/core": minor
"@flowpanel/react": minor
---

**B5 — Realtime via pg LISTEN/NOTIFY.**

- `defineResource({ realtime: true })` now publishes `resource.<key>` events
  on every successful mutation (create/update/delete/action).
- `publishResourceEvent(db, key, payload)` helper lands in `@flowpanel/core`
  — writes to `flowpanel_events`, picked up by the existing SSE broker via
  pg `LISTEN` (or polling fallback).
- `useLive({ channel, onEvent })` hook in `@flowpanel/react` — subscribes
  to a realtime channel with auto-reconnect and polling fallback status.

Writes are fire-and-forget so broker failures never affect the underlying
mutation. Zero config for a single Postgres deployment; no extra
infrastructure for multi-process.
