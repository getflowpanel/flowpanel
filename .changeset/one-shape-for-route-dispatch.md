---
"@flowpanel/next": patch
---

Dispatch routes from a table, and build the action context once.

`handlers()` matched eleven routes by hand, each repeating a length check, a
segment comparison, a destructure and a guard. The two GET copies answered a
malformed route with `{ error }` while the nine POST copies answered
`{ ok: false, error }` — the same failure in two shapes, one of them missing the
`ok` field every client tests. A pattern table replaces them and answers in one
shape.

The nine-line action context — request, database, `unsafe.db`, actor id,
publisher — was rebuilt inline by all four action routes. It is now
`buildActionContext`.
