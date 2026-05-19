---
title: 'Actions'
description: 'FlowPanel ships two action shapes for resources: per-row (RowAction) and bulk (BulkAction).'
---


FlowPanel ships **two action shapes** for resources: per-row (`RowAction`)
and bulk (`BulkAction`). Both render in the resource list / drawer and
share most options.

> **WIP — collection / link / dialog kinds, plus a builder callback
> (`actions: (a) => ({ ... })`), are not implemented.** Use the array
> shapes documented below.

## Where actions live

```ts
resource(schema.users, {
  // per-row inline / menu actions
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
  // sticky bulk bar over selection
  bulkActions: [
    {
      key: "archiveMany",
      label: "Archive selected",
      variant: "destructive",
      confirm: "Archive all selected users?",
      run: async (ids, _input, ctx) => {
        await ctx.db.update(users).set({ archivedAt: new Date() }).where(inArray(users.id, ids));
        return { ok: true, refresh: true };
      },
    },
  ],
});
```

Drawer-scoped actions live under `drawer.actions` with their own shape
(`DrawerAction`, `packages/core/src/types/drawer.ts:34`).

## `RowAction<Row>`

Defined at `packages/core/src/types/action.ts:19`.

| Field | Type |
|---|---|
| `key` | `string` |
| `label` | `string` |
| `icon` | `string` |
| `variant` | `"default" \| "destructive" \| "success"` |
| `placement` | `"inline" \| "menu"` |
| `confirm` | `string \| { title; description?; confirmLabel? }` |
| `form` | `FieldDef<Row>[]` |
| `hidden` | `(row, ctx) => boolean \| Promise<boolean>` |
| `disabled` | `(row) => boolean \| string` |
| `requireRole` | `string \| string[]` |
| `run` | `(row, input, ctx: ActionContext) => Promise<ActionResult>` |

## `BulkAction<Row>`

Defined at `packages/core/src/types/action.ts:33`.

| Field | Type |
|---|---|
| `key` | `string` |
| `label` | `string` |
| `icon` | `string` |
| `variant` | `"default" \| "destructive"` |
| `confirm` | `string \| { title; description? }` |
| `form` | `FieldDef<Row>[]` |
| `requireRole` | `string \| string[]` |
| `run` | `(ids: string[], input, ctx: ActionContext) => Promise<ActionResult>` |

## `ActionResult`

`packages/core/src/types/action.ts:5` — a discriminated union:

```ts
type ActionResult =
  | { ok: true;  message?: string;
                refresh?: boolean | string[];
                redirect?: string;
                download?: { filename: string; data: string | Blob | Uint8Array; mime?: string } }
  | { ok: false; error: string;
                fieldErrors?: Record<string, string> };
```

- `refresh: true` invalidates the current resource list; pass an array of
  resource names to invalidate several.
- `download` triggers a file download client-side.
- `fieldErrors` maps form-field names to per-field error messages
  surfaced under each input.

## `ActionContext`

`packages/core/src/types/context.ts:50` — extends `RequestContext` with:

```ts
interface ActionContext<Db = InferDB> extends RequestContext {
  db: Db;
  publish: (channel: string, payload?: unknown) => Promise<void>;
}
```

`RequestContext` carries `req`, `session`, `role`, `scope`, `ip`,
`userAgent` (`packages/core/src/types/context.ts:4`).

## Optional form input

If `form: FieldDef<Row>[]` is set, the runtime opens a dialog before
calling `run`; the user-entered values are passed as the `input` argument
(typed `unknown` — validate inside `run`). `FieldDef` is documented in
[Resources](../resources/) and lives at `packages/core/src/types/resource.ts:73`.

## Role gating

```ts
requireRole: "admin",
requireRole: ["admin", "support"],
```

When the session role doesn't match, the action button is not rendered.
There is no separate `access: { ... }` block.
