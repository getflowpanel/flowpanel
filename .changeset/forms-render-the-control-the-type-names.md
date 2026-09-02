---
"@flowpanel/react": minor
"@flowpanel/cli": patch
---

Field types render the control their name promises.

`type: "switch"` now renders the shipped `Switch` toggle with checkbox form
semantics; it previously fell back to a plain checkbox, leaving the component
named after the type unreachable. Introspected enum columns render as a select
of their values instead of a free-text input.

Also removed what nothing could reach: the `DateRangePicker.allowCustom` prop
that was declared and ignored, an unexported `CopyButton`, and the
`fp-anim-sheet-top`/`-bottom` animation classes no element used (the CLI's
`admin.css` templates mirror the removal). `useTheme.setTheme` writes through
the shared storage helper instead of a hardcoded key, and the Drizzle CSV
export helper neutralises leading formula sigils the way the built-in list
export always has.
