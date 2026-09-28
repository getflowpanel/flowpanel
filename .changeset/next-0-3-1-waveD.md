---
"@flowpanel/next": patch
---

Detail tab triggers carry `data-fp-tab`. `adminWidgetContext(config, options)` builds the context a widget receives in that admin, and `resolveWidget(widget, ctx)` returns the props its card would receive.

`realtime: { resource }` subscribes a widget, a dashboard, a widget table or a drawer card to that resource's own channel, and `ctx.query(fn)` hands `fn` the context it runs in.
