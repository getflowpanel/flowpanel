---
"@flowpanel/core": patch
"@flowpanel/next": patch
---

Remove `resolveDateRange` and `DateRangeInput` from the public `@flowpanel/core` surface; they now live inside `@flowpanel/next` (the only consumer).
