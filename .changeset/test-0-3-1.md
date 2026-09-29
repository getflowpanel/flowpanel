---
"@flowpanel/test": patch
---

`@flowpanel/test/widgets` adds `widgetContext`, `resolveWidget` and `headerContext` (what a record page hands `detail.title`, `subtitle` and `badge`): a widget's number, links and props, unit-tested with the admin's own code over rows you pass, with `query(fn)` called with the context as the admin does. It needs `@flowpanel/kit`, a new optional peer, and in Vitest both `server.deps.inline: [/@flowpanel\//]` and, when a config or test imports through your `@/` alias, `resolve.alias` (Vitest does not read `tsconfig.json`'s `paths`) — see [Run it in Vitest](https://flowpanel.tech/docs/reference/testing#run-it-in-vitest).

`smokeAdmin` now opens every detail tab of each record page it reaches and reports it with its `?tab=`; `tabs: false` keeps the old walk.
