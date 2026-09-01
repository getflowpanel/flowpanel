---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
---

Fix the release-blocking gaps found reviewing 0.2.0.

**Bulk delete works.** The compiler injected a default `delete` bulk action
whose `run` was a sentinel no runtime layer intercepted, so every resource with
delete enabled and no custom `bulkActions` shipped a Delete button that failed
with an internal message and deleted nothing. The injected action is now marked
for the runtime (`isBuiltinBulkDelete`), and the bulk route executes it through
the resource's own delete path — honouring `delete.softDelete`, the bound
scope, and the `delete` operation's access rule, which it previously skipped.
`deleteRow` is now the single delete used by both the bulk route and the
server-side `delete` action. A resource's `delete.confirm` text is also carried
into the injected confirmation dialog instead of being ignored.

**The JSON list endpoint no longer filters on undeclared columns.** `GET
<api>/<resource>?filter.<field>=…` forwarded any field straight to the adapter,
which applied an equality clause to any physical column — turning row counts
into an oracle over undeclared and `sensitive` columns. It now applies the same
declared-field allowlist the server-rendered list has always used.

**`paths.api` reaches the browser.** The option was honoured server-side while
18 client fetches hardcoded `/api/flowpanel`, so mounting the handlers anywhere
else left the admin unable to write. `FlowpanelGlobals` now publishes the mount
point through `ApiBaseProvider`, and every client fetch — drawer, row/bulk/
dashboard actions, restore, import, inline edit, reference search and the SSE
stream — derives its URL from `useApiBase()`.

**Realtime events reach subscribers.** `runtime.events.publish` published on a
private publisher instance under a `${config.id}:` channel prefix that no
subscriber applies, so it silently delivered nothing; it now publishes through
the same bound publisher the SSE route subscribes to, on the channel the caller
named. `bindPublisher` also stopped being a permanent no-op once a stray
`publish()` had installed the in-memory fallback: it keys on the bound config,
so a later real binding takes effect.

**Both SSE clients read frames the same way.** The connection pool behind
`useLiveChannel` accepted non-envelope frames and fanned them out to every
listener on the shared connection — including subscribers of other channels —
while `RealtimeProvider` dropped them per ADR 0014. Both now read frames
through one `readFrame`, so only `{ channel, payload }` envelopes are delivered
and only to that channel's subscribers.

**Inline edit accepts the columns it advertises.** A column marked
`editable: true` that a resource's explicit update form omitted was rejected as
an unknown field.

**Write routes share one bounded body parser.** JSON and multipart mutations
now reject malformed input consistently, and payloads larger than 1 MiB fail
before handlers allocate or validate the complete body.

**Field read policy reaches every row surface.** Server-rendered lists, JSON
lists and drawer payloads now project rows through the same request-level
allowlist, including fields needed only for labels, formats and drawer headers.

**New rows get a one-shot entry treatment.** Create responses expose the stable
`createdKey`; generated forms preserve the current query and hash while
redirecting, and desktop tables and mobile cards highlight that row without
disregarding reduced-motion preferences.

**Embedded shells can avoid duplicate skip links.** `shell.skipLink` and
`AdminShell.showSkipLink` let a host layout own the page's single skip target.

**404s stop enumerating the registry.** Unknown resource/action/dashboard
responses listed every registered name whenever `NODE_ENV !== "production"`,
before the auth and CSRF guards ran. The body is terse in every environment and
development gets the registry on the server log instead.

**Reference labels survive a soft delete.** A reference pointing at a
soft-deleted row rendered its raw id; label lookups now reach deleted rows.

Breaking: `FlowpanelGlobals` takes `apiBase`; `buildReferenceSearchUrl` takes
the API base as a third argument.
