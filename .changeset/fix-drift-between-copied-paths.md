---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
"@flowpanel/cli": patch
---

Fix behaviour that drifted between paths written by copy.

**Bulk actions could not name their confirm button.** `RowAction` and
`DashboardAction` accept `confirm.confirmLabel` and a `"success"` variant;
`BulkAction` was copied before both existed and never caught up, so its dialog
hardcoded its own label and its type rejected `"success"`. All three now share
`ActionConfirm` and `ActionVariant`, and the bulk dialog honours a declared
label.

**A resource's name was resolved four different ways.** The sidebar used
`plural ?? label ?? humanize(name)`, the list heading repeated that expression,
and the edit and detail headings used `label ?? name` — so a resource with
`labelOne: "Blog Post"` read "New Blog Post" on create but "Edit blog_posts" on
edit and showed the raw registry name in the detail title. All four now go
through `singularLabel` / `pluralLabel`.

**The CLI had two tsconfig readers.** `migrate` used a string-aware JSONC
stripper; `detect` used `raw.replace(/\/\/[^\n]*/g, "")`, which mishandles block
comments and `//` inside string values. A tsconfig that parsed for
`flowpanel migrate` could report no path alias to `flowpanel init`. Both read
through one `readTsconfigOptions`.

**`ReferencePicker` was a stale fork of `AsyncSelect`.** It kept its own
debounce, popover and cmdk list, and swallowed a failed search into an empty
result — so a reference lookup that errored rendered "No results". It is now a
thin adapter over `AsyncSelect` and inherits its loading state, error state and
ARIA wiring.

**A drawer action's result skipped output validation** that the other three
action routes apply. `DrawerAction` is typed to return no data, so nothing could
leak through the type system, but a cast now fails loudly instead of being
forwarded.

**`@flowpanel/core` could publish without its `labels` typings:** concurrent
tsup configs with `clean: true` could delete each other's output, so the build
now clears `dist` once before tsup starts.
