---
"@flowpanel/core": minor
"@flowpanel/next": patch
"@flowpanel/react": minor
---

Generated create and edit pages speak the configured language. A new `labels.form`
group holds the two heading templates — both take `{label}` for the resource's
singular label — and the strings a select or reference search shows while it is
empty, searching or failing. The submit button reads `actions.create` on a create
form and `actions.save` on an edit form; `actions.create` is new, so a Russian
admin no longer renders `Edit Пользователь` and `Save`. The English defaults are
the wording these controls already used.

Both pages now offer a cancel link back to the record or its list, labelled with
`actions.cancel`. It navigates and never submits. `AutoForm` takes it as
`cancelHref`; its `submitLabel` now defaults to `actions.save`, and an explicit
value still wins, including an empty string.

A caller's own placeholder or empty-state text continues to take precedence over
the configuration, and no domain enum, custom renderer or server validation
message is translated.

`labels.notFound` covers the admin's own not-found page.
