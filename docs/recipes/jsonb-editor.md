# JSONB / JSON column editor

Postgres `jsonb` columns (and Prisma `Json`, Drizzle `jsonb()`) are where
"we'll figure out the schema later" goes to live forever. An admin needs to
see the contents without scrolling through a 40-line string, and edit
without destroying valid JSON on a typo.

FlowPanel ships the basic pieces:

- a `type: "json"` field on
  [`FieldDef`](../../packages/core/src/types/resource.ts) — the form
  renderer wires this to the
  [`JsonEditor`](../../packages/react/src/_data/JsonEditor.tsx) primitive
  (a textarea with on-the-fly parse + error message; see
  [`Field.tsx:75-81`](../../packages/react/src/_forms/Field.tsx))
- a `ColumnDef.render: (row, ctx) => ReactNode` hook for custom list-cell
  rendering (see
  [`types/resource.ts:17-28`](../../packages/core/src/types/resource.ts))
- typed `RowAction.form?: FieldDef[]` so a row action can pop a form with
  validated fields (see
  [`types/action.ts`](../../packages/core/src/types/action.ts))

There is **no** named-cell-renderer registry (e.g. `render: "json-preview"`),
no `<FlowPanelUI components={{ ... }} />` slot for arbitrary keys, no
`a.dialog(...)` action builder, and no `columns: (c) => [...]` builder
function. Earlier drafts of this page used those — they don't exist and
have been removed.

Pick from the three options below based on how much the admin will edit
the column.

## Option A — read-only collapsed view (80% of cases)

If admins only read the JSON (configs, incoming webhooks, audit payloads),
the cheapest option is a column with a custom `render` function:

```ts
// flowpanel.config.ts
import { resource } from "flowpanel";
import { JsonPreview } from "@/admin/JsonPreview"; // your component

resource(prisma.webhook, {
  label: "Webhooks",
  columns: [
    "id",
    "receivedAt",
    "source",
    {
      field: "payload",
      label: "Payload",
      render: (row) => <JsonPreview value={(row as { payload: unknown }).payload} />,
    },
  ],
});
```

```tsx
// src/admin/JsonPreview.tsx
"use client";
import { useState } from "react";

export function JsonPreview({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  if (value == null) return <span className="text-fp-text-3">—</span>;

  const text = typeof value === "string" ? value : JSON.stringify(value);
  const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="inline-block"
    >
      <summary className="cursor-pointer font-mono text-xs">{preview}</summary>
      <pre className="mt-1 max-h-96 overflow-auto rounded-fp bg-fp-bg-2 p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
```

If admins also need to edit raw JSON in the resource form, declare the
field with `type: "json"` — the built-in `Field` component renders the
shipped `JsonEditor` (parse error live-displayed, hidden input keeps the
value form-submittable):

```ts
resource(prisma.webhook, {
  // ...
  update: {
    fields: [
      { name: "source", type: "text", required: true },
      { name: "payload", type: "json", label: "Payload" },
    ],
  },
});
```

## Option B — full edit with validation (shaped column)

If the JSON column has a stable shape (config blobs, feature flags),
don't expose it as raw JSON in the form at all. Use a typed
`RowAction.form` so the dialog has labelled fields and the handler
assembles the object:

```ts
import type { RowAction } from "@flowpanel/core";

const editFlags: RowAction<typeof prisma.user.fields> = {
  key: "editFlags",
  label: "Edit flags",
  form: [
    { name: "betaFeatures", type: "boolean", label: "Enable beta" },
    { name: "maxProjects", type: "number", label: "Max projects", defaultValue: 10 },
    {
      name: "plan",
      type: "select",
      label: "Plan",
      options: [
        { label: "Free", value: "free" },
        { label: "Pro", value: "pro" },
        { label: "Team", value: "team" },
      ],
      required: true,
    },
  ],
  run: async (row, input, ctx) => {
    await ctx.db.user.update({
      where: { id: (row as { id: string }).id },
      data: { flags: input as Record<string, unknown> },
    });
    return { ok: true, refresh: true };
  },
};

resource(prisma.user, {
  columns: [
    "email",
    {
      field: "flags",
      label: "Flags",
      render: (row) => <JsonPreview value={(row as { flags: unknown }).flags} />,
    },
  ],
  actions: [editFlags],
});
```

This is the **boring right answer** for shaped data. Validation comes
from `FieldDef` (required, types, options) and admins can't typo-corrupt
the column.

## Option C — free-form edit

For genuinely free-form edits, lean on `type: "json"` in a normal
`update.fields` declaration — that's exactly what the shipped
`JsonEditor` is for. There is no extra wiring needed:

```ts
resource(prisma.user, {
  // ...
  update: {
    fields: [
      { name: "email", type: "email", required: true },
      { name: "flags", type: "json", label: "Feature flags" },
    ],
  },
});
```

If you need a richer editor (Monaco / CodeMirror, schema-driven), eject
the resource (see README) and own the form yourself. FlowPanel does not
ship a pluggable form-field registry today.

## Querying by a JSON key

Filtering on a JSON property (`WHERE flags->>'plan' = 'pro'`) is not
something FlowPanel generates from a `filters` declaration — adapter
support varies and the SQL is hard to round-trip through the typed
filter shape. The pattern: surface it as a regular column sourced from
a generated column or a view.

```sql
-- migrations/0002_flags_plan.sql
ALTER TABLE users
  ADD COLUMN plan TEXT GENERATED ALWAYS AS (flags ->> 'plan') STORED;
CREATE INDEX users_plan_idx ON users (plan);
```

Then treat `plan` as a regular column in your resource — list filtering,
sorting, and indexing all come for free.

## Checklist before shipping

- [ ] Pick Option A (preview + `type: "json"` field) unless admins really
      edit the column shape.
- [ ] Free-form edits go through `update.fields` with `type: "json"`,
      which renders `JsonEditor` with parse-error feedback.
- [ ] Multi-tenant `scope` (other recipe) still applies — writing
      `{ flags: input }` goes through the same per-resource scope you
      configured.
- [ ] If you need filtering on a JSON key, surface it as a generated
      column with an index; don't reach into the filter shape.

## What we deliberately don't do

- **No Monaco / CodeMirror in the core bundle.** The shipped
  `JsonEditor` is a textarea with parse feedback. A full editor adds
  ~500 KB gzipped and most admins never edit JSON. If you want one,
  eject the resource form and own it.
- **No JSON-schema auto-inference.** Peeking at a column's contents to
  guess a schema is fragile and lies by the second record.
