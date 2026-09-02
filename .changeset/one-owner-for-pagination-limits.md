---
"@flowpanel/next": patch
---

Give pagination limits a single owner.

`ResourceController.list` already clamped `pageSize`, so the JSON route's own cap
was a second limit that disagreed with it — and lost, since the controller runs
last. The route passes the requested values through and the controller clamps
both: `pageSize` to its existing maximum, and `page` to 100 000, which the
programmatic API previously did not bound at all.
