---
"@flowpanel/react": patch
"@flowpanel/next": patch
"@flowpanel/eslint-plugin": patch
"@flowpanel/charts": patch
---

Collapse helpers that existed in more than one copy. No behaviour changes.

Six routes hand-wrote the 404 that `notFoundResponse` already produces, so they
answered without the development-mode hint naming the registered resources. They
call the helper now.

`findPropertyByName` and `asStringLiteral` were declared three and two times
across the lint rules; both live in `ast-utils`.

`@flowpanel/react` re-exports `NumericFormat` and `Tone` from `@flowpanel/core`
rather than mirroring the unions, so adding a variant in core can no longer leave
the two vocabularies disagreeing. The import is type-only and keeps the client
bundle free of core's runtime.

Also removes comment noise: doc comments a bulk edit had truncated mid-sentence,
cross-references to a doc comment that says nothing extra, and module banners
that restated the filename. The one comment that carried a real constraint — why
a read-only `<select>` needs a hidden input — is repaired rather than deleted.
