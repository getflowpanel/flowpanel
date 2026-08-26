---
"@flowpanel/next": minor
---

Enforce the resource `access` map on every entry point that reaches a resource.

**Action routes were ungated.** `withGuards` consulted a resource's `access` map
only when the caller passed an explicit `operation`. CRUD routes pass one; the
row, drawer and custom bulk action routes do not. Because `assertCanonicalAccess`
forbids declaring `access` and `requireRole` together, a resource using the
canonical `access` map has no `requireRole` — and `requireAuthorized` reads only
`requireRole`. A resource declaring `access: { update: "admin" }` therefore
returned 403 on its list page while `POST /<resource>/<id>/actions/<key>`
executed for any authenticated caller.

An action that declares its own `access` or `requireRole` is now governed by that
rule alone — the same rule that decides whether the action is rendered, so a
visible action stays a runnable one. An action that declares neither inherits the
resource's `update` rule instead of running unguarded.

**SSE channels and navigation read the same rule.** `stream()` admitted a
`resource.<name>` subscription whenever `requireRole` was undefined, so an
`access`-guarded resource broadcast every `{ action, id }` mutation to callers
forbidden to read it. `buildNav` advertised those resources in the sidebar, where
clicking produced the 403 the page correctly raises. Both now resolve the `read`
rule through `resolveOperationAccess`. `buildNav` is consequently async: access
rules may be predicates.

**Delegated actions no longer strip their own CSRF evidence.** The programmatic
controllers build an internal request from the caller's headers and deleted
`origin` and `sec-fetch-site` from it — precisely the two headers
`guardSameOrigin` inspects — so any userland route delegating to
`controller.action`, `controller.bulk` or `controller.restore` accepted
cross-site writes carrying the victim's cookie. The headers are preserved, and
the inner guard sees the real provenance.
