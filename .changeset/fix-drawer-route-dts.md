---
"@flowpanel/next": patch
---

Fix `tsup` DTS build failure in `drawer-route.ts`: `listCtx` was annotated as `ListQueryContext<Record<string, unknown>>` but `Adapter.list` expects `ListQueryContext<unknown>`. The mismatch slipped past `tsc --noEmit` and only surfaced in tsup's DTS bundler. Both call sites (`:150`, `:267`) now use `ListQueryContext<unknown>`, matching the adapter signature.
