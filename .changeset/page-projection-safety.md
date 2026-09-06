---
"@flowpanel/core": minor
"@flowpanel/next": patch
---

Add `detail.expose` for detail-only callback dependencies. List and detail pages
now send field-policy-filtered, introspected projections to adapters: lists no
longer load drawer or detail-only fields, and detail tabs load only their active
field set. Readable soft-delete markers remain server-only operational metadata,
and unconditional active tabs avoid a redundant detail read.
