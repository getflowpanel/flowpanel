# JSONB / JSON column editor

Postgres `jsonb` columns (and Prisma `Json`, Drizzle `jsonb()`) are where
"we'll figure out the schema later" goes to live forever. An admin needs to
see the contents without scrolling through a 40-line string, edit safely
without destroying valid JSON on a typo, and occasionally search on a key.

FlowPanel gives you three knobs. Pick based on how much the admin will
actually edit the column.

## Option A — read-only collapsed view (80% of cases)

If admins only read the JSON (configs, incoming webhooks, audit payloads),
the cheapest option is a custom cell renderer that shows a compact preview
with a click-to-expand:

```ts
// flowpanel.config.ts
resources: [
  resource(prisma.webhook, {
    columns: (w) => [
      w.id,
      w.receivedAt,
      w.source,
      { id: "payload", label: "Payload", render: "json-preview" },
    ],
  }),
]
```

```tsx
// src/flowpanel/widgets/JsonPreview.tsx
"use client";
import { useState } from "react";

export function JsonPreview({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  if (value == null) return <span className="text-muted-foreground">—</span>;

  const text = typeof value === "string" ? value : JSON.stringify(value);
  const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="inline-block"
    >
      <summary className="cursor-pointer font-mono text-xs">{preview}</summary>
      <pre className="mt-1 max-h-96 overflow-auto rounded-md bg-muted p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
```

Wire it in once:

```tsx
<FlowPanelUI config={flowpanel} components={{ "json-preview": JsonPreview }} />
```

**No special form field.** The default form will render this column as
a textarea of raw JSON — acceptable since the 80% case doesn't edit here.

## Option B — full edit with validation (shaped column)

If the JSON column has a stable shape (config blobs, feature flags,
webhook settings), don't store it as JSON in the form at all — edit it
through a `dialog` action with typed fields, and write back the assembled
object:

```ts
const featureFlags = resource(prisma.user, {
  columns: (u) => [u.email, { id: "flags", label: "Flags", render: "json-preview" }],
  actions: (a) => ({
    editFlags: a.dialog({
      label: "Edit flags",
      schema: {
        fields: [
          { name: "betaFeatures", type: "boolean", label: "Enable beta" },
          { name: "maxProjects", type: "number", label: "Max projects", defaultValue: 10 },
          {
            name: "plan",
            type: "select",
            label: "Plan",
            options: ["free", "pro", "team"],
            required: true,
          },
        ],
      },
      handler: async (values, row, ctx) => {
        await ctx.db.user.update({
          where: { id: row!.id },
          data: { flags: values }, // Prisma serializes to JSONB
        });
      },
    }),
  }),
});
```

This is the **boring right answer** for shaped data. Validation is free
(form marks required, enforces numbers), and admins can't typo-corrupt
the column. You trade flexibility for correctness — worth it unless the
shape really is open-ended.

## Option C — free-form edit (the rare last resort)

If admins genuinely need to edit arbitrary JSON (you're building a
FlowPanel admin for FlowPanel, basically), ship a code-editor-lite
custom widget and validate on submit:

```bash
pnpm flowpanel add json-field       # (not in default set yet — write it)
```

```tsx
// src/flowpanel/widgets/JsonField.tsx
"use client";
import { useState } from "react";

export function JsonField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  const tryParse = (next: string) => {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      setError(null);
      onChange(parsed);
    } catch (e) {
      setError((e as Error).message);
      // Don't call onChange — keep the last valid object upstream.
    }
  };

  return (
    <div className="space-y-1">
      <textarea
        value={text}
        onChange={(e) => tryParse(e.target.value)}
        rows={10}
        className="w-full rounded-md border border-input bg-transparent p-2 font-mono text-xs"
        spellCheck={false}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

Wire it as a form field override for the `flags` column:

```tsx
<FlowPanelUI
  config={flowpanel}
  components={{
    "json-preview": JsonPreview,
    "form:flags": JsonField, // reserved prefix for form field overrides
  }}
/>
```

## Querying by a JSON key

Filtering on a JSON property (`WHERE flags->>'plan' = 'pro'`) is not
something FlowPanel generates from a `filter` builder — adapter support
varies and the SQL is hard to round-trip through the normalized filter
IR. The pattern: expose it as a **computed column** sourced from a
generated column or a view.

```sql
-- migrations/0002_flags_plan.sql
ALTER TABLE users
  ADD COLUMN plan TEXT GENERATED ALWAYS AS (flags ->> 'plan') STORED;
CREATE INDEX users_plan_idx ON users (plan);
```

Then treat `plan` as a regular column in your resource — you get list
filtering, sorting, and indexes for free.

## Checklist before shipping

- [ ] Pick Option A (preview) unless admins really edit the column.
- [ ] Free-form edits always go through a `dialog` with server-side
      validation — a client-side JSON parser is not authorisation.
- [ ] `row-level security` still applies — writing `{ flags: values }`
      goes through the same access rules as any update.
- [ ] If you need filtering on a JSON key, surface it as a generated
      column with an index; don't reach into the resource filter IR.

## What we deliberately don't do

- **No Monaco / CodeMirror in the core bundle.** A full editor adds
  ~500 KB gzipped and most admins never edit JSON. If you want one,
  lazy-load it in a custom form field you own.
- **No JSON schema auto-inference.** Peeking at a column's contents to
  guess a schema is fragile and lies by the second record.
