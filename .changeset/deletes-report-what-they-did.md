---
"@flowpanel/next": minor
---

Make a delete report what it actually did.

The single-row delete ran no existence check. `deleteRow` returns nothing, the
drizzle adapter issues `DELETE … WHERE id = ? AND <scope>` without reading the
affected count, and Prisma uses `deleteMany` whenever a scope is bound — so a
delete that matched no row was indistinguishable from one that removed data. The
route then wrote an audit entry and published a `delete` event regardless. In a
scoped admin, a tenant deleting another tenant's row got a success, a realtime
event, and an audit trail asserting a deletion that never happened, while the
bulk route correctly answered 404 for the same id. The single-row path now reads
the row as the caller sees it before deleting, exactly as bulk does.

The builtin bulk delete ran its ids through a sequential, non-transactional loop.
A failure on the two-hundredth row left the first hundred and ninety-nine gone,
returned a 500, and skipped the audit emit and revalidation entirely — a partial
delete with no trail. The batch now runs inside `adapter.transaction` when the
adapter offers one, and falls back to the previous behaviour when it does not.

Both paths read rows through one `readRow` helper rather than rebuilding the
item query context inline.
