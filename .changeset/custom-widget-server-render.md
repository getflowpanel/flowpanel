---
"@flowpanel/next": patch
"@flowpanel/react": patch
---

Fix `custom()` widgets failing at runtime with "Functions cannot be passed
directly to Client Components".

`@flowpanel/react` is bundled with a top-level `"use client"` directive
(it contains client components like `DataTable`), so its `CustomWidget`
component was implicitly treated as a client component by `render-widget`.
Passing the user-authored `Component` prop (a function) across that
boundary crashed RSC serialization, and dashboards using `custom()` widgets
rendered a "Widget failed" tile.

`@flowpanel/next` now renders custom widgets server-side directly in
`render-widget.tsx`: the user's `Component` is invoked in the same RSC
context where the dashboard config was authored, and only the resulting
JSX (a serializable React tree) crosses into any client widget frame.
A small internal `ServerCard` shell wraps the output for visual parity
with the previous framed render. No consumer API changes — props of
`custom()` are unchanged.

`@flowpanel/react`'s `CustomWidget` is kept (and JSDoc-deprecated) for
direct client-side consumers that were already operating in a client
context.
