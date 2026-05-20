---
"@flowpanel/next": patch
---

Extract `requireAuthorized(config, resource, reqCtx)` helper; drop the `as RequireRole` casts that were patching around the type mismatch agent A just fixed.
