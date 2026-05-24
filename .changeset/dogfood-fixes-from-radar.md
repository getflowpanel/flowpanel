---
"flowpanel": minor
"@flowpanel/core": minor
"@flowpanel/adapter-drizzle": minor
"@flowpanel/adapter-prisma": minor
---

Three fixes surfaced by the freelance-radar dogfood.

- **`DashboardAction.form` generic widened.** Was `FieldDef<unknown>[]`,
  which collapsed `FieldDef.name` (`keyof Row & string`) to `never`, so
  consumers could not supply a literal `name` like `{ name: "queue", ... }`.
  Now `FieldDef<Record<string, unknown>>[]` — the form is a form schema,
  not a row schema, so the row type is intentionally a string-keyed record.
- **Barrel re-export.** `DashboardAction` is now re-exported from the
  umbrella `flowpanel` package alongside the other public types.
- **Null-sentinel filter values for adapters.** `FilterDef` reserves two
  string values that adapters translate at the SQL/ORM level:
  - `"__null__"` → `WHERE <field> IS NULL` (drizzle: `isNull(col)`,
    prisma: `{ [field]: null }`)
  - `"__notnull__"` → `WHERE <field> IS NOT NULL` (drizzle:
    `isNotNull(col)`, prisma: `{ [field]: { not: null } }`)
  Previously the adapters passed these sentinels through literally, so a
  `value: "__null__"` select option produced `WHERE field = '__null__'`
  and matched zero rows. Both `@flowpanel/adapter-drizzle` and
  `@flowpanel/adapter-prisma` now recognise the sentinels.
