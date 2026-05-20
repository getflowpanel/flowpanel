---
title: 'Resources'
description: 'A resource is a CRUD-backed entity in your admin: a Drizzle table or a Prisma model delegate.'
---


A **resource** is a CRUD-backed entity in your admin: a Drizzle table or a
Prisma model delegate. The first argument to `resource()` is the raw
reference; the adapter handles introspection.

```ts
import { resource } from "flowpanel";

resource(schema.users, {
  label: "Users",
  columns: ["email", "plan", "status", "createdAt"],
  search: ["email", "telegramId"],
  filters: [{ field: "plan", type: "select", options: [/* ... */] }],
  defaultSort: { field: "createdAt", dir: "desc" },
  rowClick: "drawer",
  delete: { softDelete: "deletedAt" },
});
```

The full option set is `ResourceOptions<Row>` in
`packages/core/src/types/resource.ts:111`.

## Columns

`columns` is **required** and is an array of either field names (strings)
or `ColumnDef<Row>` objects. There is no builder callback shape.

```ts
columns: ["email", "plan", "createdAt"]
```

```ts
columns: [
  "email",
  { field: "createdAt", label: "Joined", sortable: true, width: 160 },
  {
    field: "status",
    render: (row) => <Badge>{row.status}</Badge>,
    tone: (row) => (row.status === "canceled" ? "err" : null),
  },
]
```

`ColumnDef<Row>` (`packages/core/src/types/resource.ts:17`):

| Field | Type |
|---|---|
| `field` | `keyof Row & string` |
| `label` | `string` |
| `render` | `(row, ctx) => ReactNode` |
| `sortable` | `boolean` |
| `width` | `number \| string` |
| `align` | `"left" \| "center" \| "right"` |
| `className` | `string` |
| `hidden` | `boolean` |
| `pinnable` | `boolean` |
| `tone` | `(row) => "ok" \| "warn" \| "err" \| null` |

There is no per-column `format` option. Use `render` if you need custom
cell rendering.

### Default header / label humanization

Column headers, drawer field labels, and auto-generated form labels are
humanized by default when no explicit `label` is set.

| Input | Default label |
|---|---|
| `email` | `Email` |
| `firstName` | `First name` |
| `created_at` | `Created at` |
| `telegramId` | `Telegram ID` |
| `apiKey` | `API key` |

Common initialisms stay uppercase regardless of position: `ID`, `URL`,
`URI`, `API`, `IP`, `UUID`, `UI`, `UX`, `HTTP`, `HTTPS`, `SQL`, `JSON`,
`CSV`, `XML`, `HTML`, `CSS`, `DNS`, `TCP`, `UDP`, `SSL`, `TLS`, `JWT`,
`OTP`, `SMS`, `MS`, `DB`. Source: `packages/react/src/lib/humanize.ts:17`.

Passing an explicit `label` short-circuits humanization — including
`label: ""` to render an empty header. The same rule applies to
`FieldDef.label` and `DrawerAction` labels.

The functions are exported from `@flowpanel/react` for reuse in custom
cells:

```ts
import { humanize, resolveFieldLabel } from "@flowpanel/react";

humanize("createdAt");                   // "Created at"
resolveFieldLabel(undefined, "email");   // "Email"
resolveFieldLabel("Plan", "plan");       // "Plan"
```

## Filters

`filters` is an array of field names (strings) or `FilterDef<Row>` objects
(`packages/core/src/types/resource.ts:39`).

```ts
filters: [
  { field: "plan", type: "select", label: "Plan", options: [
    { label: "Free", value: "free" },
    { label: "Pro",  value: "pro"  },
  ]},
  { field: "createdAt", type: "daterange", label: "Joined" },
  { field: "archived", type: "boolean" },
]
```

`type` is one of `"text" | "select" | "multiselect" | "daterange" |
"numeric-range" | "boolean" | "tag"` (`packages/core/src/types/resource.ts:30`).

## Search

```ts
search: ["email", "telegramId"]
```

The option is `search`, **not** `searchFields`. It accepts an array of
column names (`packages/core/src/types/resource.ts:119`). The toolbar
runs a contains-style match across the listed fields.

## Sort, paging, density

```ts
defaultSort: { field: "createdAt", dir: "desc" },
pageSize: 50,
density: "compact",        // or "comfortable"
rowClick: "drawer",        // "drawer" | "detail" | (row) => string | undefined | false
rowKey: "id",
```

(`packages/core/src/types/resource.ts:121`)

## CRUD gates

```ts
create: { disabled?: boolean, fields?: FieldDef<Row>[], defaultValues?: Partial<Row> }
update: { disabled?: boolean, fields?: FieldDef<Row>[] }
delete: { disabled?: boolean, softDelete?: keyof Row & string, confirm?: string }
```

(`packages/core/src/types/resource.ts:135`). When `delete.softDelete` is a
column name, the runtime `UPDATE`s that column with `now()` instead of
issuing a hard `DELETE`, and filters out non-null rows from list queries
(`packages/core/src/types/context.ts:31`).

## Row & bulk actions

```ts
actions: [
  {
    key: "disable",
    label: "Disable user",
    variant: "destructive",
    confirm: "Disable this user? They'll lose access immediately.",
    run: async (row, _input, ctx) => {
      await ctx.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, row.id));
      return { ok: true, message: "Disabled", refresh: true };
    },
  },
],
bulkActions: [/* same shape, run: (ids, input, ctx) => ActionResult */],
```

Shapes: `RowAction<Row>` and `BulkAction<Row>` in
`packages/core/src/types/action.ts:19`. `ActionResult` (success or
failure variants) is at `packages/core/src/types/action.ts:5`.

## Drawer

```ts
drawer: {
  width: "lg",                     // "sm"|"md"|"lg"|"xl"|"2xl"|"full"
  header: (row) => row.email,
  fields: "*",                     // or string[] of column names
  actions: [/* DrawerAction[] */],
  viewDetailsLink: true,
}
```

Shapes in `packages/core/src/types/drawer.ts`. Drawer actions take
`(row, formData, ctx)` and return `{ ok, message?, refresh? }`.

## Schema and field overrides

```ts
schema: zUserCreate,                                  // single ZodTypeAny
schema: { create: zUserCreate, update: zUserUpdate }, // or per-op
create: { fields: [{ name: "email", type: "email", required: true }] },
```

`FieldDef<Row>` (`packages/core/src/types/resource.ts:73`) covers `type`,
`label`, `placeholder`, `help`, `validate` (Zod or function), `required`,
`readOnly`, `hidden`, `defaultValue`, `transform`, `span`, `group`,
`reference`, `options`.

## Scope (row-level security)

Per-resource scope merges into every list/get/mutate. It is set at the
resource level — there is no separate `access` block.

```ts
resource(schema.posts, {
  ...,
  scope: (scope, query) => ({ ...query, where: { ...query.where, tenantId: scope.tenantId } }),
})
```

Or opt out: `scope: "bypass"` (`packages/core/src/types/resource.ts:142`).
The global scope is set at the admin level via `defineAdmin({ scope })`
(`packages/core/src/types/config.ts:82`):

```ts
defineAdmin({
  scope: ({ session }) => ({ tenantId: (session as any)?.tenantId }),
  resources: [...],
});
```

When global scope is non-null, every resource must declare its own
`scope` callback or `scope: "bypass"` — otherwise
`assertResourceScope` throws a `FlowpanelAccessError`
(`packages/core/src/runtime/scope.ts:8`).

## Role gating

```ts
requireRole: "admin",
requireRole: ["admin", "support"],
requireRole: (session) => Boolean(session?.tenantOwner),
```

(`packages/core/src/types/resource.ts:143`). Same shape as the global
`auth.requireRole` in `AuthConfig`.

## Custom queries

When the auto-generated list/get path is too rigid:

```ts
listQuery: async (ctx) => ({ rows, total, page, pageSize }),
itemQuery: async (ctx) => row,
```

Contexts: `ListQueryContext<Row>` and `ItemQueryContext` in
`packages/core/src/types/context.ts:20`. Each carries `db`, `session`,
`scope`, `searchParams`, `signal`, plus list-specific `filters / sort /
page / pageSize / search / softDelete?`.

## Export

```ts
export: { formats: ["csv", "json"], fields: ["id", "email", "createdAt"] }
export: false                                                              // disable
```

(`packages/core/src/types/resource.ts:148`).

## Realtime

```ts
realtime: true                  // publishes resource.<name> on every mutation
realtime: "resource.users"      // explicit channel name
```

(`packages/core/src/types/resource.ts:151`). Channel naming and the
publisher contract are covered in [Realtime](../realtime/).

## Audit

`audit: true` opts a resource into the global audit sink configured via
`defineAdmin({ audit: { sink, enabled? } })`
(`packages/core/src/types/config.ts:53`). The runtime helper is
`emitAudit(cfg, event)` exported from `@flowpanel/core`
(`packages/core/src/runtime/audit.ts:3`); the per-event shape is
`AuditEvent`:

```ts
interface AuditEvent {
  actorId: string | null;
  action: string;
  resource?: string;
  targetId?: string;
  diff?: { before: unknown; after: unknown };
  ip?: string;
  userAgent?: string;
  at: Date;
}
```

(`packages/core/src/types/config.ts:42`).
