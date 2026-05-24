---
"@flowpanel/adapter-drizzle": patch
"@flowpanel/adapter-prisma": patch
"@flowpanel/core": patch
---

Fix tenant-scope enforcement gap in `restore`. Both the Drizzle and Prisma
adapters previously restored soft-deleted rows by bare primary key, bypassing
the tenant scope predicate that every other by-id mutation (`get`, `update`,
`delete`) enforces. An out-of-scope `restore` could un-delete another tenant's
row.

`restore` now ANDs the captured scope clauses into the WHERE (Drizzle) /
merges the scope keys via `updateMany` when a scope is bound (Prisma), and
fail-closes with `FlowpanelAccessError` when `scopeRequired && !applyScope` —
matching `delete`.

Also widens `Adapter.update`'s return type to `Promise<unknown | null>` to
document that a 0-row update (e.g. an out-of-scope id) returns `null`, and
removes the prior double-cast in the Prisma adapter.
