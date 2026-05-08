---
"@flowpanel/core": minor
"@flowpanel/next": minor
---

Realtime publisher is now bound to `AdminConfig.realtime` (driver: "memory" | "redis").

- `@flowpanel/core`: new `RealtimeConfig` type (alias of `PublisherOptions`); `AdminConfig.realtime` field.
- `@flowpanel/next`: new `bindPublisher(config)` and `subscribe(channel, handler)` exports; the runtime publisher is re-created from `config.realtime` at each entry point (server actions, drawer route, page render). `publish` / `publishResource` API unchanged.
