---
"@flowpanel/core": minor
"@flowpanel/next": patch
"@flowpanel/react": minor
---

Record identifiers survive the URL. Every route atom — a resource name, a record
id, a literal segment — is percent-encoded when a link is built and decoded
exactly once when the page route reads it back, so an id carrying `/`, `%`, `?`,
`#`, a space or a leading slash addresses the record it names instead of routing
somewhere else or 404ing. Configured nested paths for dashboards and custom pages
keep their separators: they are joined as paths, not escaped as one atom. The
inline-edit request escapes its resource and id the way every other client fetch
already did.

Row identity is decided by the value, not by coercing it: a key column that the
projection omitted, or that holds a non-scalar value, yields no identifier — on
the client and on the server, where the soft-delete and row-action maps were
still keying on the literal string `"undefined"`.

A deployment `basePath` now reaches the requests the browser makes on its own.
Next prefixes `Link` and router navigation for you but not a `fetch` or a form
`action`, so FlowPanel adds it to `apiBase`, to the generated form actions and to
the client metadata's `paths.api`. The new `withDeploymentBasePath` export does
the same for a host's own fetches against `paths.api`; pass it an app-relative
path, because a path that already carries the prefix cannot be told apart from one
that merely starts with the same segment. Handler dispatch, `revalidatePath` and
admin links are untouched, because those are already correct.

A row whose projection did not include the key column no longer pretends to be
addressable: it renders, but offers no selection checkbox, no inline editor and no
row activation, and no keyboard shortcut acts on it either, in the table and in
the mobile card list. Selecting all selects only rows that have an identifier. The
literal string `"undefined"` remains a valid identifier.

The detail page's edit action is a `Link` rather than a bare anchor.

`withDeploymentBasePath` is exported from `@flowpanel/core/paths` as well as
`@flowpanel/react`, because a server component cannot call a client export.
