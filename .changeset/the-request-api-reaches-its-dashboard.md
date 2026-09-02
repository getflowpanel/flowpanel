---
"@flowpanel/next": patch
---

`request().dashboard(path).action(...)` reaches its dashboard again.

The controller validated the path against the registry, then handed the raw
path to a route that decodes an encoded one — so every delegated dashboard
action 404'd. The controller now encodes before dispatch, and the encoding is
injective: a path containing literal underscores (`/a__b`) no longer decodes
into a different dashboard's path. The controller path is covered by a test
for the first time.
