# @flowpanel/core

Internal core package for FlowPanel — public types, `defineAdmin`, builders, runtime helpers.

**Not published separately.** Users install [`flowpanel`](../flowpanel), which re-exports from here.

See the specification at [`docs/spec/flowpanel-v1.0.md`](../../docs/spec/flowpanel-v1.0.md) and the plan at [`docs/superpowers/plans/`](../../docs/superpowers/plans/).

## Exports

- `defineAdmin(config): ResolvedAdminConfig`
- `resource<Row>(ref, options): ResourceConfig`
- Types: `AdminConfig`, `ResourceOptions`, `ColumnDef`, `FilterDef`, `FieldDef`, `DetailTab`, `DrawerConfig`, `Adapter`, `QueryContext`, `ListQueryContext`, `RowAction`, `BulkAction`, `ActionResult`, `Session`, `Scope`, `FlowpanelError` (and subclasses)
