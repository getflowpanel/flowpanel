# @flowpanel/next

## 0.2.0

### Minor Changes

- 2804944: Every entry point that reaches a resource goes through the same guards, decoders and dispatch table, so the JSON API, the rendered page and the action routes agree on access, filters, pagination, deletes and error envelopes. Writes from an admin behind a reverse proxy are accepted, and the drawer opens and switches tabs without a server round-trip.

### Patch Changes

- Updated dependencies [2804944]
- Updated dependencies [2804944]
  - @flowpanel/core@0.2.0
  - @flowpanel/react@0.2.0

## 0.1.0

First public release. The Next.js App Router integration: the admin page component, API route handlers, server-rendered list/detail/dashboard pages, drawers, server actions (row / bulk / dashboard / inline), and SSE realtime.
