---
"@flowpanel/core": minor
"@flowpanel/adapter-drizzle": patch
"@flowpanel/adapter-prisma": patch
---

Give the fail-closed scope rule one definition.

Both first-party adapters resolved the bound tenant predicate themselves, with
the same fallback chain and the same refusal — down to an identical two-line
message. A hardening change to either was invisible to the other, and a
third-party adapter had only prose to copy from.

`resolveScopeApplier(ctx)` in `@flowpanel/core` is now that rule: it returns the
bound predicate, `null` when the resource declares no scope, and throws
`FlowpanelAccessError` when a scope is required but absent. Both adapters call
it, and `docs/reference/runtime-contracts` states the obligation for anyone
writing a third.
