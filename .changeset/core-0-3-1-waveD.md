---
"@flowpanel/core": patch
---

`toneTextClass` and `toneFillClass` map every tone to the class the built-in cards use, and are safe to read in a server component.

The worker `createPublisher` from `@flowpanel/core/publish` accepts any ioredis client and the admin's own `{ driver: "redis", url, keyPrefix }` options, sends `resource(name, { action, id })` events, and resolves instead of rejecting when Redis fails, reporting through `onError` or one log line per error kind.

`realtime` on every widget and dashboard also takes `{ resource: name }`, checked at `defineAdmin` with a did-you-mean. A select filter or a choice form field without `options` on an `enumOf` badge column lists the enum's labels. `ctx.query(fn)` with no arguments calls `fn(ctx)` when `fn` declares a parameter; a function whose first parameter is optional without a default (`days?: number`) now receives the context, so give it a default or pass the argument. `EnumDef.badge(value, { href })` links the pill.
