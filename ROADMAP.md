# FlowPanel roadmap

## Next

- List filters through a predicate or a relation: `where(value, ctx)` on `FilterDef`, or `relation.field` filters.
- Dynamic action `emphasis`: a predicate instead of a fixed value.
- Drawer actions with `href`.
- A per-step note on funnels.
- Phone cards that do not clip rendered cells.
- `ctx.unsafe.db` typed as present on an action that declares `unsafe: ["db"]`, and filled on query contexts.
- A resource link built from a union of resource names that accepts a filter on the fields they share.
- Filter option resolvers receive the caller's `role` and `scope`.
- Adapters read and write through the same injected client when a host passes one.
