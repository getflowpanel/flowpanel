# Resources

A **resource** is a CRUD-backed entity in your admin: a Prisma model, a Drizzle table, or anything the adapter knows how to list / read / create / update / delete.

```ts
resource(modelRef, {
  label?, labelPlural?,
  defaultSort?, defaultPageSize?,
  columns, filters?, searchFields?,
  actions?, access?, fieldAccess?,
  icon?, readOnly?,
})
```

`modelRef` is your Prisma model delegate (`prisma.user`) or Drizzle table (`users`).

## Columns

Two shapes are supported:

**Shorthand — an array of path functions.** Fast path for the 80% case:

```ts
columns: [
  (p) => p.email,
  (p) => p.createdAt,
  (p) => p.profile.country,   // deep paths work too
]
```

**Builder — when you need control:**

```ts
columns: (c) => [
  c.field((p) => p.email, { label: "Email", sortable: true }),
  c.field((p) => p.status, { format: "enum" }),
  c.computed("revenue", {
    label: "Revenue",
    format: "money",
    compute: (row) => row.orders.reduce((s, o) => s + o.total, 0),
  }),
  c.custom({
    id: "actions-col",
    label: "",
    render: MyCustomCell, // a React component
  }),
]
```

### Cell formats

FlowPanel auto-detects formatting from Prisma/Drizzle metadata, but you can override with `format`:

| Format | Renders as |
|---|---|
| `text` (default) | plain text |
| `enum` | shadcn Badge |
| `money` | `$1,234.56` |
| `relative` | "2h ago" |
| `absolute` | locale timestamp |
| `boolean` | check/cross icon |
| `image` | avatar with fallback |
| `json` | collapsible JSON |

## Filters

Shorthand — any path that resolves to a scalar becomes a typed filter:

```ts
filters: [(p) => p.role, (p) => p.createdAt, (p) => p.active]
```

FlowPanel picks the widget by type:

- `string` → text contains
- `enum` → multi-select (shadcn Select)
- `number` → range input
- `boolean` → yes/no/any
- `Date` / `DateTime` → date range picker (shadcn Calendar)

Builder for custom filters:

```ts
filters: (f) => [
  f.filter((p) => p.email, { label: "Email", mode: "contains" }),
  f.custom({
    id: "plan",
    label: "Plan tier",
    mode: "enum",
    render: MyCustomFilter,
    toWhere: (value) => ({ plan: value }),
  }),
]
```

## Search

```ts
searchFields: ["email", "name"]
```

The toolbar renders a debounced search input that ORs across the listed fields with `contains` semantics.

## Access control

`access` is checked before every operation. Each rule accepts:

- `false` — deny all
- `string[]` — role allowlist
- `(ctx, row?) => boolean` — arbitrary predicate

```ts
access: {
  list:   true,                                  // anyone authed
  read:   true,
  create: ["admin"],
  update: ["admin", "support"],
  delete: false,                                 // nobody
  archive: (ctx, row) => row?.userId === ctx.session.userId,
}
```

## Ctx

Every handler receives a `ctx` object:

```ts
{
  session,      // from security.auth.getSession
  db,           // your Prisma client or Drizzle db (primary adapter)
  config,       // FlowPanel config
  resources,    // all resolved resources
  req,          // the original Request
  ...           // anything from your `context` option
}
```

## Row-level security

```ts
defineFlowPanel({
  ...
  rowLevel: (ctx) => ({
    tenantId: ctx.session.tenantId,   // every row must match
  }),
});
```

This merges into every find/update/delete. A tenant can never see another tenant's records — including via action handlers.
