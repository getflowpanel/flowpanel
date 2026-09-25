---
"@flowpanel/kit": patch
---

`resource(view, { writeTo: table })` lists and opens a SQL view and writes edits to its table.

`related("response")` is a whole related tab: filter, hidden column, count and paging come from the target's `reference`. `table({ resource, where, range })` shows the rows of one record or one period.

`{ variant: "strip", widgets: [...] }` turns a row of metric cards into one hairline KPI strip.
A record page gets a KPI strip (`detail.stats`), a side column (`detail.aside`), its own date range (`detail.dateRange`) and several linked header badges, and `kv({ items: [{ field }] })` reads the viewed row without a closure per fact.

`timeline({ kinds: Activity, query })` replaces a hand-built activity feed: day groups, kind chips, folding and paging come with it.

`timeline.source("user_visit", { kind: "visit", at: "startedAt" })` turns a table into timeline events with no SQL, filtered to the viewed record.

`heatmap({ source: { resource: "user_visit", at: "startedAt" } })` shows 13 weeks of visits on a card with no host component.

`checklist({ ordered: true, layout: "steps", items })` replaces a hand-built trace, and `checklist({ items: (c) => filled(profile, labels) })` a completeness card.

`kv({ items: [{ label: "About", field: "bio", long: true }] })` shows profile texts without a custom component.

`{ field: "name", secondary: "email" }` shows the email under the name in a list without a `render`.
