---
"@flowpanel/kit": patch
---

`resource(view, { writeTo: table })` lists and opens a SQL view and writes edits to its table.

`related("response")` is a whole related tab: filter, hidden column, count and paging come from the target's `reference`. `table({ resource, where, range })` shows the rows of one record or one period.

`{ variant: "strip", widgets: [...] }` turns a row of metric cards into one hairline KPI strip.
A record page gets a KPI strip (`detail.stats`), a side column (`detail.aside`), its own date range (`detail.dateRange`) and several linked header badges, and `kv({ items: [{ field }] })` reads the viewed row without a closure per fact.
