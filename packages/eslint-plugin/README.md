# @flowpanel/eslint-plugin

ESLint rules that catch the most common mistakes in FlowPanel admin configs.

> Pre-1.0. The rule names are stable; the surface (options, message text) may
> still shift before 1.0.

## Install

```bash
pnpm add -D @flowpanel/eslint-plugin
```

## Setup (ESLint v9 flat config)

```ts
// eslint.config.ts
import flowpanel from "@flowpanel/eslint-plugin";

export default [
  {
    plugins: { flowpanel },
    rules: {
      "flowpanel/prefer-shorthand-filter": "warn",
      "flowpanel/audit-row-action-needs-confirm": "error",
      "flowpanel/no-server-import-in-client": "error",
      "flowpanel/require-unique-resource-names": "error",
      "flowpanel/no-typo-column-keyword": "warn",
    },
  },
];
```

## Rules

| Rule | Type | Fixable |
| --- | --- | --- |
| `prefer-shorthand-filter` | suggestion | yes |
| `audit-row-action-needs-confirm` | problem | no |
| `no-server-import-in-client` | problem | no |
| `require-unique-resource-names` | problem | no |
| `no-typo-column-keyword` | problem | yes |

### `prefer-shorthand-filter`

When every entry of `options:` inside a `filters: [...]` array has
`label === value`, the array can be written as a string array. The runtime
normalizes both shapes to the same thing.

```ts
// bad
filters: [
  {
    key: "status",
    type: "select",
    options: [
      { label: "active", value: "active" },
      { label: "archived", value: "archived" },
    ],
  },
];

// good (auto-fixable)
filters: [
  { key: "status", type: "select", options: ["active", "archived"] },
];
```

### `audit-row-action-needs-confirm`

An entry in `actions: [...]` or `bulkActions: [...]` with
`variant: "destructive"` and no sibling `confirm:` property is reported. You
have to provide the message yourself, so this rule is not auto-fixable.

```ts
// bad
actions: [
  { key: "delete", label: "Delete", variant: "destructive", run },
];

// good
actions: [
  {
    key: "delete",
    label: "Delete",
    variant: "destructive",
    confirm: "Are you sure?",
    run,
  },
];
```

### `no-server-import-in-client`

In a file that starts with `"use client"`, importing a server-only module
ships server code to the browser. The rule flags:

- `server-only` and `*/server-only`
- any path containing a `/server/` (or terminal `/server`) segment
- `@/db`, `@/db/...` (and the `~/db`, `src/db`, `./db` variants)

### `require-unique-resource-names`

Within a single `defineAdmin({ resources: [...] })` call, every `resource()`
entry must resolve to a unique name. This rule looks at `opts.name` when it is
a string literal; names inferred from the ref at runtime are handled by the
runtime validator.

### `no-typo-column-keyword`

Heuristic check for common camelCase typos in `columns: [...]` (string form
or object form with `key`/`name`). v1 only catches a short list of known
typos: `userid`, `createdat`, `updatedat`, `isactive`. Full schema-aware
validation is tracked separately.

## License

MIT
