---
"@flowpanel/next": minor
---

Make the JSON API answer like the page it mirrors.

**Filters reached the adapter unparsed.** The JSON list route applied the
declared-field allowlist and then handed the raw query strings straight to
`controller.list`, while the rendered page ran them through
`sanitizeFilterValues` first. `?filter.createdAt=2024-01-01:2024-12-31` therefore
arrived as an equality bind of that whole string against a date column —
`invalid input syntax` on Postgres, silently zero rows on SQLite — and a
multi-select filter matched nothing instead of the values it named. Both paths
now resolve the same filter specs and sanitize identically, and `page` /
`pageSize` are clamped rather than forwarded verbatim.

**Guard failures broke `@flowpanel/client`.** Routes answering with `Result`
failed in a different envelope than they succeeded in: a flat `error: string`
where `isResult` requires `{ code, message }`. Every 401, 403 and 429 reached
consumers as `internal` / "Unexpected response from Flowpanel", so the documented
`result.error.code` handling could never see the real code. `withGuards` now
takes the envelope the route speaks; the JSON API and programmatic controllers
fail in `Result`, while action and form routes keep answering with
`ActionResult`, whose `error` is the operator-facing message.

**A Decimal column took the whole response down.** `toWireValue` rejected every
non-plain object, so one Prisma `Decimal` turned a successful list into a 422
`Validation failed`. A value that declares `toJSON()` has stated how it
serializes and is now encoded through it; a `Map` or a live database handle still
fails loudly, and the message names the offending class instead of "object".
