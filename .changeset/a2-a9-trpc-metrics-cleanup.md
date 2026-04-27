---
"@flowpanel/core": patch
---

**A2 + A9 — cleanup.**

- A2: centralise the unavoidable tRPC-builder `any`s into `trpc/types.ts`;
  stages/drawers/metrics procedures now use typed `AuthedContext` + `z.infer`
  inputs. 12 inline suppressions removed.
- A9: deprecate the legacy string-SQL `config.metrics` block. Continues to
  work; logs a one-time warning at startup pointing to the B2 helpers
  (`metric()` / `timeseries()` / `breakdown()`). Planned for removal in 1.0.
