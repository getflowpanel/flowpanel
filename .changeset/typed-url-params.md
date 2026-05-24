---
"@flowpanel/core": minor
"@flowpanel/react": minor
---

Typed dashboard URL params.

Adds `DashboardConfig.urlParams?: Record<string, UrlParamSpec>` (core) — a
declarative registry pairing a Zod schema (validating the raw query-string
value) with a typed default. Optional and additive: dashboards that don't
declare params keep reading `req.url` directly.

New `useDashboardParam(key, schema, fallback)` hook (react) returns
`{ value, setValue, pending }`. It validates the URL param against the
schema and the setter performs soft navigation — `router.push(...,
{ scroll: false })` inside `useTransition` — dropping the param when it
equals the fallback for clean URLs. Replaces the hand-rolled
read/validate/push/transition block that dashboards previously duplicated
at each call site (the dogfood `PlatformChart` range toggle is the
canonical example).

The schema must accept a string input (`z.coerce.number()`,
`z.enum([...])`). Params are scalar-only; encode objects/arrays as JSON.

New exports:
- `@flowpanel/core`: `UrlParamSpec` (type)
- `@flowpanel/react`: `useDashboardParam`, `UseDashboardParamResult` (type)

Documented in **ADR 0011**. Builder purity (I-3) preserved — `urlParams`
is a plain literal field. +7 unit tests.
