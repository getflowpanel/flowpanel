---
"@flowpanel/core": patch
---

A resource can read a database view and write to a table: `writeTo` names the table that create, update, delete and restore use, and `ResourceIntrospection.kind` reports a view. A view without `writeTo` is read-only, and a declared write, a form field its table lacks, or a table key the view does not select is an error at `defineAdmin`. `writeTarget(resource)` returns where a resource writes.

`related(resource, options)` builds a related tab in one line: `defineAdmin` infers the target's field that points at the record from its declared `reference` (none or several ask for `by`), turns `by` into the tab's filter and hidden column, and checks `by`, `hide` and `sort` against the target. `DetailTab` gains `by`, `count` and `pageSize`, and moves to `types/detail.ts` with the same exports.

`table({ resource, where, range })` narrows a resource table by a filter or a function of the context and bounds it by the picked range; both are checked at `defineAdmin`. `labels.detail.tabCount` words a counted tab.

`SectionConfig.variant: "strip"` draws a section's metric and stat widgets as one hairline-divided band without card chrome.
`DetailOptions<Row>` names a resource's record page, so a card in its own file is typed with `satisfies DetailOptions<RowOf<"user">>`. It gains `stats` (a strip under the header), `aside` (a side column) and `dateRange` (a header picker whose range reaches the strip, the aside and every widgets tab); `title`, `subtitle` and `badge` receive a `DetailHeaderContext` with `format`, `labels` and `link`, and `badge` may return several `DetailBadge`s, each with an optional `href`.
`kv` items take `field` to show a field of the card's `record`, which defaults to the viewed row on a record page.
