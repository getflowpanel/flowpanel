---
"@flowpanel/react": patch
"@flowpanel/charts": patch
"@flowpanel/cli": patch
"@flowpanel/next": patch
---

Charts honour the configured currency. A chart whose `format` is `"currency"` used
to print the built-in default in its tooltip and on its value axis, whatever
`formatting.currency` said, so a dashboard in euros showed dollars beside a table
that showed euros. Every chart now reads the admin's resolved locale and currency
and hands it to the tooltip and the tick formatter, so one number reads the same
way wherever it appears. `useFormatting` is exported from `@flowpanel/react` for
hosts rendering their own values next to ours.

A scaffolded admin layout carries the CSP nonce. When `flowpanel init` writes the
admin segment its own root layout, that layout reads the `x-nonce` request header
and passes it to `ThemeScript`, so a host whose middleware sets that header no longer
has the pre-hydration theme script blocked by its own `script-src` policy. FlowPanel
does not write the middleware: with no `x-nonce` on the request nothing changes.

A reference picker no longer bills every form for a command palette. `AsyncSelect`
and the `ReferencePicker` built on it now render FlowPanel's own listbox instead of
`cmdk`, so an app importing the forms pays 69.3 kB instead of 72.6 kB for the UI
bundle — under the 70 kB the invariant asks for. `cmdk` stays installed; the ⌘K
command palette is its one remaining consumer.

The roles and keys a reader relies on are the ones that were there: a `combobox`
search box that always names its `listbox`, `aria-activedescendant` on the
highlighted row, ArrowUp and ArrowDown without wrapping at either end, Home, End,
`Ctrl+N`/`Ctrl+J` and `Ctrl+P`/`Ctrl+K`, `Cmd+ArrowDown`/`Cmd+ArrowUp` to jump to
the last and first option, Enter to pick and Escape to close. The highlighted option
is scrolled into view as you arrow past the bottom of the list, which is what makes
a twenty-row reference list usable from the keyboard. Two things do differ from the
`cmdk` version, both improvements: Tab now closes the picker and returns focus to the
field instead of being swallowed, so the next Tab moves on, and an empty result is
announced through a live region rather than rendered silently. The option list is also the scroll container now, so
there is no second focusable region between the search box and the options.

An admin that is signed out says so to a smoke test. The sign-in and access-denied
screens now carry `data-fp-error`, so `smokeAdmin` reports a refusal instead of a
healthy page that happens to be empty.

`flowpanel doctor`'s checks moved into their own module, leaving the command file
as wiring; the CLI behaves exactly as before.
