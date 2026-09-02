---
"@flowpanel/core": minor
"@flowpanel/react": minor
"@flowpanel/next": minor
---

Collapse three implementations this release had duplicated across packages.

`formatColumnValue` is new in `@flowpanel/core`: the pure `money` / `number`
half of `ColumnDef.format`, previously copied verbatim into
`@flowpanel/react`'s `formatNumericCell` and `@flowpanel/next`'s
`formatNumericValue` because react ships behind a `"use client"` banner a
server component cannot call into. Core has no banner, so both sides now
import the one function and keep only their own badge JSX. The copies had
already started to diverge on the badge tone lookup — `typeof format ===
"object"` on the client versus an extra `format.kind === "badge"` re-check on
the server. The re-check was unreachable dead weight (the enclosing guard
already admits only `"badge"` and `{ kind: "badge" }`), so both sides keep the
client's form, and a parity test pins that the two renderers resolve the same
status and tone for the same input.

`SelectOption` → `{ label, value: String(value) }` was re-implemented at five
places inside `@flowpanel/next` — resource form fields, row/bulk action form
fields, dashboard action form fields, list filter specs, and the drawer's
string-only variant. That `String(value)` is the wire contract clients
round-trip back through filters and form submissions, so it now lives in one
helper the five sites call. Only the list-filter async branch changes at all:
it used to skip the string shorthand its declared type forbids, and now
accepts it like everywhere else.

Action dialogs render through the canonical `FormField` control set. A row,
bulk, dashboard or drawer action declaring `form: [{ name, type }]` used to go
through the dialog's own control chain, which handled textarea / select /
multiselect / boolean / tags and fell everything else through to a plain text
input — so `reference`, `json`, `radio` and `markdown` fields silently
rendered as text boxes in an action dialog while rendering their real controls
in a resource form. They now render identically in both places, backed by the
new `StandaloneFormFields` provider in `@flowpanel/react`, which supplies
those controls with the context they need outside a schema-driven `<Form>`.

Two consequences of that switch are worth knowing. `required` on an action
form field now marks the control `aria-required` instead of setting the native
`required` attribute, matching how a resource form marks it — the field is
still enforced server-side by the action's `input` schema. And a `json` field
submits the JSON text the editor holds, the same string a resource form posts
for a json column, rather than a parsed object.
