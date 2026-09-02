---
"@flowpanel/core": patch
"@flowpanel/client": minor
---

Say only true things in the config surface.

`useAdminMutation`'s `rollbackOn` documented a rollback strategy the hook
never implemented — it is gone, and the hook's documentation now says what it
wraps: any async action returning an `ActionResult`, not a Server Action.
`AdminDefinition.id`'s docstring now names where the value actually goes (the
wire client metadata) instead of promising diagnostics and logs that never
read it. `AuthConfig.allowUnauthenticated`'s docstring states the real
production rule: without `requireRole`, production refuses to start unless it
is `true` and the admin is `readOnly`.
