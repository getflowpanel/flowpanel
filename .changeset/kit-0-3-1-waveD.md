---
"@flowpanel/kit": patch
---

`@flowpanel/kit/styles/tailwind.css` is the Tailwind v4 bridge to FlowPanel's tokens, generated from the stylesheet, so custom widgets can use `bg-fp-*`, `text-fp-*`, `rounded-fp*` and `shadow-fp-*` without copying the token list.

`@flowpanel/kit/publish` carries the worker publisher's `resource()`, `onError` and admin-options form.

`@flowpanel/kit/next` exports `adminWidgetContext` and `resolveWidget`.

`llms.txt` covers `{ resource }` realtime targets, enum options on filters and fields, `query(fn)` and linked badges.

`llms.txt` documents `flowpanel new --dir`.

`@flowpanel/kit` ships `llms/`: the documentation one section per file, or one page per file for a section over 1,000 lines, with `llms/index.txt` naming each; the site serves the same files at `/llms/<file>`. The docs gain a founder-admin tutorial and guides for record pages and custom widgets.
