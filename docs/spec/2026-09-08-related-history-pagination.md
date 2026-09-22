# Complete related histories

The built-in resource detail tab currently reads 25 rows, discards adapter total,
and renders a pager fixed to page one without a navigation handler. A record
after the first 25 is unreachable. Fix this shared contract before adopting the
next package collection in FreelanceRadar.

## Behavior

- Preserve the authorized related-read implementation. Add an internal page
  result helper; keep `readRelatedRows` as the compatible rows-only wrapper for
  reference/drawer/widget consumers. Preserve null for denied resource access.
- Return actual total/page/pageSize with projected rows. Relationship filters
  remain mandatory constraints: undefined parent values or denied filter fields
  yield no rows and no adapter query. Keep scope, field access, explicit known
  select and re-projection from the preceding safety phase.
- A related tab has its own URL page key, `relatedPage.<tab-key>`. Parse through
  the same bounded integer contract as list pages. Ignore unrelated or inactive
  tab keys. Preserve existing tab keys and all other URL state.
- A small client table bridge uses the existing DataTable and Next router to
  push page changes without jumping to the top. Back/Forward and reload restore
  the active tab and its page; no client-side shadow copy of server rows.
- Use the target resource's configured default sort, with primary-key order as
  the fallback. Pass only readable sort fields. The target's list columns and
  server-rendered cells remain the source of table presentation.
- Empty histories show configured noResults. A requested page past the last
  page must still permit navigation back to existing records; do not hide the
  whole table/pager merely because that page has no rows. Prefer a bounded
  correction to the last valid page, preserving the same policy and scoped
  query context. Never issue an unbounded fetch.
- No mutations, inline edit, bulk actions, export or extra navigation system is
  introduced by this phase. Host capped previews separately link to existing
  filtered resource lists.

## Evidence

RED/GREEN with at least 26 related rows: first page has 25, next page has row 26,
total stays 26, page URL is namespaced and preserves parent identity/tab/filters.
Use real DataTable pagination controls for the DOM assertion. Prove default,
invalid and out-of-range page behavior, independent tab page state, lazy inactive
queries, denied/undefined relationship constraints and select/scope retention.
Verify the compatible rows-only helper's current consumers. Capture navigation
Back/Forward/reload in a browser fixture without host writes. Run affected full
Next tests/typecheck/build, relevant React tests and lint. Independently review
the committed contract before host adoption.
