---
"@flowpanel/test": minor
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": patch
---

The smoke test every admin needs ships as a package. `@flowpanel/test` exports one
function, `smokeAdmin(page, options)`, that walks a running admin the way an
operator does — the sidebar, every dashboard and list it links to, and the first
row of each list, following whichever the resource offers: the row's own page or
its drawer. It asserts that no navigation answers 4xx or 5xx, that nothing wrote
to `console.error`, that no page rendered a FlowPanel error surface, and, when
`a11y` is on and `@axe-core/playwright` resolves, that axe reports zero WCAG 2.2
AA violations per visited route. It resolves with a `SmokeAdminReport` and throws
an `Error` carrying that report, so one `await smokeAdmin(page)` is a complete
Playwright test.

This is the class of failure unit tests and `tsc` cannot see: a column that no
longer exists, a widget query that throws against real data, a detail route that
500s for the one row whose foreign key is null. It needs a browser and a
database, so it belongs in the browser suite — install it as a dev dependency
with `@playwright/test`, and add `@axe-core/playwright` to turn the accessibility
assertions on. It is not part of `@flowpanel/kit` and never reaches an
application bundle.

A walk that discovers no routes beyond the entry page fails rather than passing. A
harness that reports success for a page it never walked is worse than no harness,
so an empty navigation is an error naming the `basePath` it looked under. The
navigation itself is now marked the same way in every shell mode: the tabs shell's
`<nav>` carries `data-flowpanel-nav` alongside the sidebar's.

The walk waits for the `main` landmark rather than for the network to go idle: an
admin holding a realtime connection never reaches `networkidle`. It finds
FlowPanel's own error surfaces by the `data-fp-error` attribute, which the card a
failed adapter read renders, the card a failed widget leaves behind, a drawer whose
payload read failed and the health banner's error tone all now carry. Those
surfaces mean the page rendered — so no navigation failed — while a read underneath
it did, which is exactly the failure a status check alone misses. A `cookie` is
added before the first page the walk inspects, so an authenticated admin's report
describes the admin and not its sign-in screen. A route is matched under `basePath`
at a segment boundary, so `/administrators` is not mistaken for part of `/admin`,
and a nav link that leaves the origin is skipped rather than rewritten onto it.

`stat()` gains the result object `metric()` already had. A resolver may return a
`StatResult` — `{ value, tone?, hint?, href? }` — so a card computed from data can
link to the rows it counted instead of stranding its `href` in static options. A
result field wins over the matching option; a `Date` is still a value, not a
result.
