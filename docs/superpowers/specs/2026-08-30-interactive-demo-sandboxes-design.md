# Interactive Demo Sandboxes Design

## Goal

Make the public ScrapeAI demo fully interactive without allowing one visitor to damage the
experience for another. A visitor must be able to create, edit, delete, and run actions against
real PostgreSQL data, reload the page, and keep seeing their changes. Every new browser sandbox
must start from the same coherent dataset and remain isolated at the database, runtime, and UI
layers.

The implementation is demo infrastructure, not a new FlowPanel product API. It deliberately
dogfoods FlowPanel's existing request scope, field policy, Drizzle transaction, and read-only
capabilities.

## Success criteria

- A new browser receives a populated sandbox before its first admin query runs.
- CRUD, inline edit, row actions, bulk actions, drawers, references, dashboards, exports, and
  realtime refreshes continue to work against PostgreSQL.
- Changes survive reloads within the same browser sandbox.
- Two browsers cannot read, mutate, export, or relationally reference each other's rows.
- Reset restores only the current sandbox in one transaction.
- Expired sandboxes are removed without requiring a continuously running application process.
- Public traffic cannot create unbounded sandboxes or use bulk import to grow the database without
  a practical limit.
- An operator can disable every public mutation with one environment variable.
- Local development and E2E use the same scoped data model rather than a separate unscoped path.

## Non-goals

- General-purpose tenant provisioning in FlowPanel core.
- Durable user accounts, authentication, billing, or user-owned production data.
- Sharing a sandbox across browsers or devices.
- Preserving a sandbox after its TTL.
- Exposing public bulk import. Import remains available in local development, where it still runs
  through the scoped create pipeline.
- Making the synthetic realtime feed tenant-specific. It may trigger harmless extra refreshes, but
  every refreshed database query remains scoped.

## Chosen approach

Each browser receives an opaque sandbox capability stored in an HttpOnly cookie. Every ScrapeAI
table belongs to that sandbox, and the existing FlowPanel global/resource scope applies the
sandbox predicate to all generated operations. The seed is copied into each sandbox lazily and
transactionally.

This is preferred over a shared mutable database with scheduled reset. A shared database allows
visitors to collide and always leaves a window in which the demo is empty or surprising. A shared
database with self-healing reset removes the empty window but can erase data while another visitor
is evaluating the product. Per-browser isolation costs more rows, but provides the predictable
experience expected from a production-oriented developer tool.

Copy-on-write overlays and per-sandbox PostgreSQL schemas were rejected. Both require a custom
query layer that would bypass or obscure the FlowPanel patterns the demo is meant to teach.

## Runtime modes

The schema is always sandboxed.

- Local development and E2E use the stable sandbox id `local`.
- `DEMO_MODE=true` enables public cookie issuance, public lifecycle limits, and the interactive
  sandbox notice.
- `DEMO_READ_ONLY=true` is an emergency kill switch wired to FlowPanel's server-enforced
  `readOnly`; it removes write affordances and rejects direct mutation requests.
- Public mode requires `DEMO_SANDBOX_SECRET`. Startup fails with a clear configuration error when
  it is absent or too short.

Using the same scope in every mode keeps seed, queries, relationships, and tests on one path.

## Data model

Add `demo_sandboxes` with:

- `id`: UUID primary key;
- `seedVersion`: integer;
- `createdAt` and `lastSeenAt`;
- `inactivityExpiresAt` and `absoluteExpiresAt`;
- `lastResetAt`;
- `fingerprintHash`: HMAC of the trusted client IP for creation throttling.

Add `demo_maintenance`, a singleton row containing `lastCleanupAt`, so multiple application
instances coordinate maintenance through PostgreSQL rather than process memory.

Every existing demo table gains:

- required `sandboxId`, referencing `demo_sandboxes.id` with `ON DELETE CASCADE`;
- nullable integer `seedKey`, used only to map deterministic generator ids while seeding;
- a unique index on `(sandboxId, seedKey)`; PostgreSQL permits multiple null values for rows created
  by visitors;
- a leading `sandboxId` component on indexes used by lists, filters, and dashboards.

The global serial `id` remains the FlowPanel row key. Seed generator ids cannot be inserted as
database ids because multiple sandboxes would collide, so `seedKey` is intentionally separate.

Every parent/child relation is protected by a composite foreign key, for example
`(sandboxId, customerId) -> customers(sandboxId, id)`. Parent tables expose the corresponding
unique `(sandboxId, id)` key. This database constraint prevents a forged request from linking a row
in one sandbox to a parent in another even if application validation regresses.

Disposable demo relations use explicit cascade behavior where a hard delete is offered. Soft
delete remains the behavior for customer accounts. Confirmation copy names dependent data when a
hard delete cascades.

## Sandbox identity and request flow

Next's `proxy.ts` runs for the demo UI and API routes. In public mode it validates the existing
sandbox cookie or generates a cryptographically random UUID, overwrites an internal
`x-flowpanel-demo-sandbox` request header, and sets the cookie with `HttpOnly`, `SameSite=Lax`, a
production-only `Secure` flag, path `/`, and a 24-hour maximum age. Client-supplied copies of the
internal header are never trusted.

In local mode the proxy binds `local` without issuing a public cookie. The Admin/Support persona
cookie changes authorization inside the same sandbox and never changes its identity.

`getDemoSession` validates the internal sandbox id, calls the idempotent sandbox initializer, and
returns `sandboxId` as part of the synthetic session. FlowPanel resolves
`scope: ({ session }) => ({ sandboxId })`. Missing or invalid sandbox identity fails closed before a
query runs.

The initializer touches `lastSeenAt` at most once every five minutes to avoid a write on every
request. It extends the inactivity deadline to 60 minutes but never passes the 24-hour absolute
deadline.

## Seed and reset

Initialization and reset acquire a PostgreSQL transaction-level advisory lock derived from the
sandbox UUID. After the lock is held, the transaction rechecks the sandbox and `seedVersion`, so
parallel first requests cannot seed twice.

The deterministic generator remains the source of the story. Persistence changes from global
`TRUNCATE` to scoped, topologically ordered writes:

1. delete or replace rows belonging to the target sandbox;
2. bulk insert customers with their generator id in `seedKey` and collect the returned database
   ids;
3. remap and bulk insert monitors, runs, products, listings, matches, invoices, and AI usage in
   dependency order;
4. update `seedVersion` and reset timestamps only after every insert succeeds;
5. commit atomically.

No page can observe a partially seeded sandbox. A code-level seed version bump causes a stale
sandbox to be rebuilt on its next request.

`db:seed` targets `local` by default and never truncates other sandboxes. The public reset endpoint
ignores caller-supplied ids and resets only the sandbox bound by the proxy. A database-backed
cooldown rejects repeated reset attempts with HTTP 429.

## Scope enforcement

All resources bind their table's `sandboxId` with the existing Drizzle resource scope. Create
forms declare a hidden `sandboxId` field whose async `defaultValue` reads the request scope.
`fieldAccess` prevents `sandboxId` and `seedKey` from appearing in lists, forms, drawers, exports,
or serialized view models. A forged hidden value is still rejected by the Drizzle adapter's
transactional create-scope verification.

The same default pipeline is used by local import. Public mode removes the import affordance and
rejects its route to eliminate the highest-amplification database growth path.

Generated resource reads already receive scope. Demo-owned SQL must add it explicitly:

- overview metrics and review summaries;
- dynamic filter options;
- domain helpers and custom mutation predicates;
- any direct relation or diagnostic query.

These call a small demo-only helper that validates `ctx.scope.sandboxId` and returns the relevant
Drizzle predicate. Custom mutations include both row id and sandbox id in their final update
predicate as defense in depth, even though FlowPanel loads action rows through scope first.

## Capacity and abuse controls

Public sandbox creation is lazy: browsing the landing page or static assets creates no database
copy. Before creating a new sandbox, one transaction performs due cleanup, checks the active
sandbox cap, and counts recent sandboxes for the request fingerprint.

Defaults are:

- at most 200 active sandboxes globally;
- at most 10 new sandboxes per fingerprint per hour;
- existing sandboxes continue to work when the creation cap is reached;
- a rejected new visitor receives a friendly HTTP 503 demo-busy page with links to docs and source.

The fingerprint is an HMAC using `DEMO_SANDBOX_SECRET`; raw IP addresses are not stored. The public
deployment must run behind a trusted proxy that replaces forwarding headers. Limits may be
overridden by explicit environment variables, but invalid or unsafe values fail validation. If a
trusted client IP is unavailable, creation uses one conservative shared `unknown` bucket and emits
a configuration diagnostic instead of accepting an attacker-controlled forwarding value.

FlowPanel's existing per-IP mutation rate limit remains active. Public bulk import is disabled.
Manual form creation is bounded by the rate limit and sandbox TTL. Structured logs record active
sandbox count, creation rejections, seed/reset failures, cleanup deletions, and approximate row
count at each maintenance pass.

## Maintenance

Every initializer attempts a cheap conditional update of the `demo_maintenance` singleton. Only
the request that advances `lastCleanupAt` performs cleanup; a global advisory lock protects against
multiple instances. Cleanup deletes sandboxes whose inactivity or absolute deadline has passed,
and foreign-key cascades remove their rows.

This lazy cleanup runs at most once per 15 minutes while the demo has traffic. `demo:cleanup`
provides the same operation as a cron entry point for predictable observability and for deployments
that want cleanup during idle periods. Correctness does not depend on cron: the next visitor cleans
expired state before capacity is evaluated.

## User experience

The public header replaces the read-only notice with:

`Interactive sandbox · Private to this browser · Resets after 60 minutes of inactivity`

It includes a `Reset data` form. The button has explicit pending, success, rate-limited, and failure
states, preserves the current admin route after success, and meets the existing mobile touch-target
rules. Reset copy explains that it affects only this browser.

An emergency read-only deployment changes the notice to state that editing is temporarily
disabled. Empty states remain useful inside a visitor's sandbox and include the reset action where
appropriate; another visitor never inherits that empty state.

## Deployment and migration

The demo Docker image applies the schema and starts the app. It no longer globally seeds on every
container boot. Local setup continues to run `db:seed` explicitly; public sandboxes seed lazily.

The schema change is destructive only to disposable demo data. Deployment resets the public demo
database once while no previous-format app instance is serving traffic. No compatibility bridge is
required between the old shared rows and the new sandboxed rows.

Required public environment:

- `DATABASE_URL`;
- `DEMO_MODE=true`;
- `DEMO_SANDBOX_SECRET`;
- trusted reverse-proxy forwarding configuration.

`DEMO_READ_ONLY=true` is documented as the operational rollback for write incidents. A full
rollback deploys the previous image against a restored disposable demo database rather than trying
to reuse sandboxed rows with the old schema.

## Testing and verification

Implementation follows red-green-refactor.

Unit and database integration coverage proves:

- cookie/header validation and local fallback;
- deterministic, idempotent seed under concurrent initialization;
- correct foreign-key remapping and complete ownership graph;
- scope on generated reads, create, import, references, exports, raw dashboard queries, and custom
  mutations;
- cross-sandbox ids and parent references fail closed;
- reset atomicity, cooldown, seed-version upgrade, TTL extension, absolute expiry, cleanup, active
  cap, and fingerprint limit;
- emergency read-only rejects direct writes.

E2E uses two isolated browser contexts and proves:

- both start populated;
- create, edit, delete, and an action persist after reload in browser A;
- browser B remains unchanged;
- direct requests cannot read or mutate A's rows from B;
- reset restores A without changing B;
- Admin/Support share one sandbox while retaining their role differences;
- the notice and reset flow work on desktop and 375px mobile.

The final release gate runs lint, typecheck, unit tests, database integration tests, production
build, demo E2E, site E2E, accessibility checks, and a manual visual pass. Public deployment then
receives a production smoke test with two clean browsers before advertising traffic is enabled.

## File boundaries

Sandbox schema, lifecycle, seed, and UI remain under `examples/ai-scraper`. Generic FlowPanel
packages receive no new demo-specific condition or public API. Existing unrelated worktree changes
are preserved, and implementation commits stage only files belonging to this feature.
