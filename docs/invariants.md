# FlowPanel Public API Invariants

Every public symbol exported from `packages/*/src/index.ts` carries one or
more invariants. **Any PR that violates an invariant must include an ADR**
explaining the deviation in `docs/adr/`.

This document is the contract surface FlowPanel commits to from 1.0.0
forward. Breaking an invariant is a major-version event.

---

## I-1 — `defineAdmin(config)` is pure

`defineAdmin` does not perform I/O, does not bind to global state, does
not start subscriptions or timers. The returned `ResolvedAdminConfig` is
the only handle to runtime state.

**Verified by:** `packages/core/src/__tests__/define-admin.test.ts`.

**Why:** the config must be importable from anywhere (Next.js page,
script, test) without side effects. Initialization happens later, when
`bindPublisher(config)` and `Flowpanel(config)` are invoked from a Next.js
route.

---

## I-2 — Adapter `kind` is the discriminant

Every `Adapter` exposes `kind: "drizzle" | "prisma"`. New adapters require
a new literal in this union — a major-version bump.

**Verified by:** `packages/core/src/types/adapter.ts`.

**Why:** code that specializes per-adapter (e.g., dialect branches in the
Drizzle adapter, DMMF lookups in the Prisma adapter) reads `kind`. A
loose type (e.g., `string`) would silently break those branches.

---

## I-3 — Builders are referentially stable

`resource(...)`, `dashboard(...)`, `metric(...)`, `table(...)`, `queue(...)`,
`page(...)`, `custom(...)`, `statGroup(...)` produce plain objects with
`kind` discriminants. They never close over module-init state and never
allocate per-call resources beyond the returned descriptor.

**Verified by:** `packages/core/src/builders/*.ts` (all builders are
~10-line functions returning literals).

**Why:** users should be able to construct widgets/resources at module
load without running anything heavy. Building lazily is the user's
choice via `custom(Component, async (ctx) => …)`.

---

## I-4 — Server-only modules are isolated from client bundles

Anything that imports `node:async_hooks`, `node:crypto`, `revalidatePath`,
or DB clients lives in a server-only file. Client modules carry
`"use client"`. The umbrella `flowpanel/client` subpath ships only the
client surface (hooks, atoms).

**Verified by:** size-limit budgets, manual bundle inspection.

**Why:** Next.js webpack bundles client code separately. A stray
`node:async_hooks` import in a client-imported module crashes the
build. M4a learned this the hard way and split `@flowpanel/core` into
`.` (server) and `./labels` (universal) subpaths.

---

## I-5 — SSE channel naming

Resource mutations publish `resource.<name>` automatically (where `<name>`
is the resource's `name` field). User-driven publishes via
`publish(channel)` accept any string.

**Verified by:** `packages/next/src/runtime/apply-action-result.ts`.

**Why:** the `<DataTable realtime="resource.<name>">` prop has to
reliably receive events without users wiring channel names by hand.

---

## I-6 — Eject targets are exactly three

`flowpanel eject` accepts `resource | dashboard | layout`. No fourth.
The marker on each ejected file is exactly:

```
// flowpanel: ejected @ <semver> — this file is yours
```

Removal of the marker is a user-driven action; FlowPanel does not strip
it.

**Verified by:** `packages/cli/src/eject/marker.ts`,
`packages/cli/src/commands/eject.ts`. Documented in **ADR 0003**.

---

## I-7 — Bundle budgets

Brotli-compressed gzipped sizes:

- `flowpanel/react` ≤ 70 KB
- `flowpanel/client` ≤ 25 KB
- `flowpanel/charts` ≤ 60 KB (loaded lazily; doesn't count toward
  initial JS)

**Enforced by:** `packages/flowpanel/.size-limit.json` in CI.

**Why:** these budgets keep the initial First Load JS for the admin under
170 KB on a real Next.js app. Exceeding a budget without a corresponding
budget revision in a release is a CI-blocking regression.

---

## I-8 — `exactOptionalPropertyTypes` everywhere in package source

All FlowPanel `packages/*/src/**` source compiles under
`exactOptionalPropertyTypes: true`. User configs do not have to.

**Enforced by:** `tsconfig.base.json`.

**Why:** see **ADR 0004**.

---

## I-9 — Semver discipline post-1.0

After 1.0.0:

- Breaking changes require a major bump and an ADR explaining why the
  break is necessary.
- Soft deprecations get a `console.warn` + at least one minor release
  of grace before removal.
- Pre-existing `string | undefined` accepters do not silently tighten to
  `string` between minors.

**Verified by:** `pnpm changeset` PR check + maintainer review.

**Why:** users embed FlowPanel in their admin chrome — silent breaks here
mean broken admin pages in production.

---

## I-10 — No global mutable state across requests

The only sanctioned global is `AsyncLocalStorage` in
`packages/core/src/runtime/request-context.ts` for scope/session. Beyond
that, no `let foo = …` at module scope mutates across requests.

**Verified by:** code review.

**Why:** Next.js can serve concurrent requests on a single Node process.
Globals lead to data leaks between users. The `AsyncLocalStorage` is the
audited exception, gated behind `runWithRequestContext(ctx, fn)`.

---

## I-11 — `theme.components` slot keys are append-only

`FlowpanelComponentSlots` is augmentable but every slot already in the
interface stays in the interface across minors. Removing a slot is a
major bump.

**Verified by:** tsd type tests at `packages/react/types-test/`.

**Why:** users register overrides via `theme.components.MetricCard = …`.
Removing the `MetricCard` slot silently disables their override — a
real-world regression we've seen in other admin frameworks.

---

## I-12 — `LabelsConfig` shape is forward-compatible

Adding new keys to `LabelsConfig` at minor bumps is allowed (with English
defaults in `DEFAULT_LABELS`). Removing or renaming keys is a major bump.
The structured nesting (`labels.bulkBar.selected`, `labels.actions.save`)
is part of the contract — flattening to `Record<string, string>` is a
major bump.

**Verified by:** `packages/core/src/types/__tests__/labels.test.ts`.

**Why:** users localize their entire admin via `labels` — losing keys
between releases breaks their translations silently.
