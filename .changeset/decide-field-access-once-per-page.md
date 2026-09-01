---
"@flowpanel/next": patch
---

Decide a list page's field access once, not once per row.

`fieldAccess.read` may be a predicate, and it may be async — a role lookup, a
feature flag, a query. The rendered list page and the JSON list route resolved
it separately for the list controls and then again for every row returned, so a
50-row page ran the same policy 51 times and the two decisions could in
principle disagree. `resolveReadableListSurface` now resolves the union of the
list controls and the projected row fields in one pass and hands back both sets,
derived from the same result. The control allowlist is unchanged: a row-only
field still cannot be filtered or sorted on.
