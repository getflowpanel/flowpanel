---
"@flowpanel/react": patch
"@flowpanel/next": patch
"@flowpanel/eslint-plugin": patch
"@flowpanel/charts": patch
---

Collapse helpers that existed in more than one copy. No behaviour changes.

Six routes hand-wrote the 404 that `notFoundResponse` already produces, so
their bodies drifted from its terse shape and skipped its development-mode
server log naming the registered resources. They call the helper now.

`findPropertyByName` and `asStringLiteral` were declared three and two times
across the lint rules; both live in `ast-utils`.

`@flowpanel/react` re-exports `NumericFormat` and `Tone` from `@flowpanel/core`
rather than mirroring the unions, so adding a variant in core can no longer leave
the two vocabularies disagreeing. The import is type-only and keeps the client
bundle free of core's runtime.
