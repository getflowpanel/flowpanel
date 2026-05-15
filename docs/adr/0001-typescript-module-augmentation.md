# ADR 0001 — TypeScript module augmentation for `db` typing

**Status:** Accepted (M2.5 → frozen for 1.0)

## Context

FlowPanel's widget builders (`metric`, `table`, `custom`, `statGroup`) and
action handlers (`DrawerAction.run`, `RowAction.run`, `BulkAction.run`) need
access to the user's typed database client via `ctx.db`. The natural shape
would be a generic on `defineAdmin<DB>` that flows down to every callback.

That doesn't work in practice. Widget builders run at module-init time,
before `defineAdmin` is called — `metric("Users", async ({ db }) => …)`
is evaluated when its module loads. There's nothing for TypeScript to
infer `DB` from at that point.

Pre-M2.5 the type was `db: unknown`, forcing every user to write
`(ctx.db as typeof db).query(…)` at every callsite. That cast undermines
the whole "type-safe admin from your schema" promise.

## Decision

Expose a consumer-augmentable `FlowpanelTypes` interface in
`@flowpanel/core` and resolve `InferDB` from it via conditional type:

```ts
// packages/core/src/types/registry.ts
export interface FlowpanelTypes {
  // empty — consumers augment
}

export type InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown;
```

User binds their `db` once in `flowpanel.config.ts`:

```ts
declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
}
```

Every `WidgetContext`, `ActionContext`, and `Adapter` then defaults its
`DB` generic to `InferDB`, so user callbacks see strongly-typed `ctx.db`
with zero per-callsite annotations.

## Consequences

**Wins:**

- Zero-cost DX: `ctx.db.select().from(schema.users)` autocompletes.
- The augmentation is opt-in. Without it, `ctx.db` is `unknown` (the
  Pre-M2.5 baseline), so users get the same behavior or better — never worse.
- Consistent across all callback contexts (`WidgetContext`, `ActionContext`,
  `MutationContext`, `ListQueryContext`).

**Costs / constraints:**

- `FlowpanelTypes` is now part of the public API — its shape must remain
  backward-compatible across minor releases.
- Augmentation must target `@flowpanel/core` exactly (not the umbrella
  `flowpanel`). Wrong target = silent no-op. Documented in the registry's
  JSDoc.
- Unit tests that exercise widget queries can't easily simulate the
  augmentation; tests use explicit generics on `metric<DB>(...)` instead.

## References

- `packages/core/src/types/registry.ts` — the augmentation point.
- `packages/core/src/types/widget.ts`, `action.ts`, `context.ts`, `adapter.ts` —
  every public callback context defaults `<DB = InferDB>`.
- `examples/freelance-radar/flowpanel.config.ts` — production augmentation
  example.
