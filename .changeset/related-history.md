---
"@flowpanel/next": minor
---

A related detail tab reaches its whole history. The tab reads the adapter's real
total and renders working pagination instead of a pager pinned to page one, so a
record after the first 25 is no longer unreachable. Each tab paginates under its
own URL key, `relatedPage.<tab key>`, parsed through the same bounded contract as
list pages, so two tabs are independent and Back, Forward and reload restore what
the reader was looking at. A page past the end corrects back to the last page that
has rows rather than showing an empty table with no way out.

Rows are sorted by the target resource's `defaultSort`, falling back to its
primary key. The relationship filter, the scope, the readable field set and the
narrow selection are unchanged, and an inactive tab still runs no query.

`readRelatedRows` keeps returning rows only, for reference, drawer and widget
callers; the paged read is `readRelatedPage`.
