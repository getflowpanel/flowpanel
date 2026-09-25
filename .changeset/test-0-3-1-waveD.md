---
"@flowpanel/test": patch
---

`smokeAdmin` opens every detail tab of each record page it reaches and reports it with its `?tab=`; `tabs: false` keeps the old walk. `@flowpanel/test/widgets` adds `widgetContext` and `resolveWidget`: a widget's number, links and props, unit-tested with the admin's own code over rows you pass. It needs `@flowpanel/kit`, an optional peer, and in Vitest `server.deps.inline: [/@flowpanel\//]`.

`widgetContext().query(fn)` calls `fn` with the context, as the admin does.
