# @flowpanel/next

## 0.2.0

### Minor Changes

- f54f815: Decode resource form submissions through the same path as action dialogs.

  The two form surfaces had two decoders, and only the action dialog's understood
  what the controls actually post. A resource create or edit form containing a
  boolean column was therefore unusable: the generated checkbox submits the native
  `"on"` token, `coerceRowByColumns` accepted only `true/1/false/0`, and the write
  came back 422 with `"on" is not a valid boolean`. An unticked checkbox submits
  nothing at all, so a boolean could never be set back to false either. A `tags` or
  `multiselect` field stored the literal string `["a","b"]` rather than the array,
  because the list encoding those controls submit was decoded on the action path
  only.

  Both surfaces now share `readFormValues`. A field the server withholds — one
  declared `hidden` — is left out of the decode rather than being read as an empty
  submission, so a withheld field is still absent from the write instead of being
  cleared.

  Separately, the generated form now offers only the columns a write may carry.
  `AutoForm` received every introspected column while `assertWritableInput` accepts
  only the resource's declared `columns`, so a resource listing a subset rendered
  inputs whose submission always failed with `Unknown field`. Both sides now read
  the same `declaredWriteFields`.

- f54f815: Make a delete report what it actually did.

  The single-row delete ran no existence check. `deleteRow` returns nothing, the
  drizzle adapter issues `DELETE … WHERE id = ? AND <scope>` without reading the
  affected count, and Prisma uses `deleteMany` whenever a scope is bound — so a
  delete that matched no row was indistinguishable from one that removed data. The
  route then wrote an audit entry and published a `delete` event regardless. In a
  scoped admin, a tenant deleting another tenant's row got a success, a realtime
  event, and an audit trail asserting a deletion that never happened, while the
  bulk route correctly answered 404 for the same id. The single-row path now reads
  the row as the caller sees it before deleting, exactly as bulk does.

  The builtin bulk delete ran its ids through a sequential, non-transactional loop.
  A failure on the two-hundredth row left the first hundred and ninety-nine gone,
  returned a 500, and skipped the audit emit and revalidation entirely — a partial
  delete with no trail. The batch now runs inside `adapter.transaction` when the
  adapter offers one, and falls back to the previous behaviour when it does not.

  Both paths read rows through one `readRow` helper rather than rebuilding the
  item query context inline.

- 52606de: Remove public API that no runtime surface ever reached, before 0.2 freezes it.

  `runMutationPipeline` and its `MutationPipelineStage`, `MutationPipeline` and
  `PostCommitEffect` types are gone from `@flowpanel/core`. They were documented
  as the one ordered mutation runner shared by generated pages, HTTP handlers and
  headless surfaces; nothing called them, and all four real mutation surfaces
  order their own stages.

  `FieldDef.visibleWhen` and `FieldDef.disabledWhen` are gone, along with the
  `UiCondition` AST and `evaluateUiCondition`. No form renderer read them:
  `resolve-form-fields` builds each `ResolvedField` explicitly and the client
  field spec has no slot for a condition tree.

  `ColumnDef.select` is gone. It was validated at compile time and folded into a
  projection nothing consulted at runtime. A `render` column that declares no
  `field` still fails compilation, with the message adjusted accordingly.

  `AdapterCapabilities` keeps only `version`. The `projections`, `transactions`,
  `atomicImport`, `returningRows` and `migrations` flags, the redundant
  `AdapterV2.transaction` redeclaration, the `adapterCapabilities` v1 bridge and
  `assertAdapterCapabilities` are removed — no runtime code branched on a flag,
  and the only consumer was a self-consistency check over the flags themselves.
  The shipped drizzle and prisma adapters now declare `capabilities: { version: 2 }`.
  `Adapter.transaction` is untouched.

  `CompiledResource.clientProjection` and `serverProjection`, the
  `collectResourceExposure` collector that built them, and `getCompiledAdmin` are
  removed from `@flowpanel/core`. The doc comment claiming the projections were
  shared by every runtime surface was false — `@flowpanel/next` derives its own
  field allowlists.

  `projectRow` is removed from `@flowpanel/next`. It was a synchronous twin of
  `projectAuthorizedRow` with only test callers, carrying a weaker field-policy
  check that would have leaked fields under a request-scoped `read` rule.
  `projectAuthorizedRow` and `declaredRowFields` are unchanged.

  The `no-server-import-in-client` ESLint rule inspects bare specifiers again.
  It had been narrowed to app-local specifiers, so a package's server subpath —
  including the one this framework itself publishes — imported from a
  `"use client"` file passed silently. `next/server` remains allowed.

- f54f815: Enforce the resource `access` map on every entry point that reaches a resource.

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

- f54f815: Fix behaviour that drifted between paths written by copy.

  **Bulk actions could not name their confirm button.** `RowAction` and
  `DashboardAction` accept `confirm.confirmLabel` and a `"success"` variant;
  `BulkAction` was copied before both existed and never caught up, so its dialog
  hardcoded its own label and its type rejected `"success"`. All three now share
  `ActionConfirm` and `ActionVariant`, and the bulk dialog honours a declared
  label.

  **A resource's name was resolved four different ways.** The sidebar used
  `plural ?? label ?? humanize(name)`, the list heading repeated that expression,
  and the edit and detail headings used `label ?? name` — so a resource with
  `labelOne: "Blog Post"` read "New Blog Post" on create but "Edit blog_posts" on
  edit and showed the raw registry name in the detail title. All four now go
  through `singularLabel` / `pluralLabel`.

  **The CLI had two tsconfig readers.** `migrate` used a string-aware JSONC
  stripper; `detect` used `raw.replace(/\/\/[^\n]*/g, "")`, which mishandles block
  comments and `//` inside string values. A tsconfig that parsed for
  `flowpanel migrate` could report no path alias to `flowpanel init`. Both read
  through one `readTsconfigOptions`.

  **`ReferencePicker` was a stale fork of `AsyncSelect`.** It kept its own
  debounce, popover and cmdk list, and swallowed a failed search into an empty
  result — so a reference lookup that errored rendered "No results". It is now a
  thin adapter over `AsyncSelect` and inherits its loading state, error state and
  ARIA wiring.

  **A drawer action's result skipped output validation** that the other three
  action routes apply. `DrawerAction` is typed to return no data, so nothing could
  leak through the type system, but a cast now fails loudly instead of being
  forwarded.

  **`@flowpanel/core` could publish without its `labels` typings:** concurrent
  tsup configs with `clean: true` could delete each other's output, so the build
  now clears `dist` once before tsup starts.

- 4157802: Allow queue pages to remain routable while being hidden from primary admin navigation.
- f54f815: Make the JSON API answer like the page it mirrors.

  **Filters reached the adapter unparsed.** The JSON list route applied the
  declared-field allowlist and then handed the raw query strings straight to
  `controller.list`, while the rendered page ran them through
  `sanitizeFilterValues` first. `?filter.createdAt=2024-01-01:2024-12-31` therefore
  arrived as an equality bind of that whole string against a date column —
  `invalid input syntax` on Postgres, silently zero rows on SQLite — and a
  multi-select filter matched nothing instead of the values it named. Both paths
  now resolve the same filter specs and sanitize identically, and `page` /
  `pageSize` are clamped rather than forwarded verbatim.

  **Guard failures broke `@flowpanel/client`.** Routes answering with `Result`
  failed in a different envelope than they succeeded in: a flat `error: string`
  where `isResult` requires `{ code, message }`. Every 401, 403 and 429 reached
  consumers as `internal` / "Unexpected response from Flowpanel", so the documented
  `result.error.code` handling could never see the real code. `withGuards` now
  takes the envelope the route speaks; the JSON API and programmatic controllers
  fail in `Result`, while action and form routes keep answering with
  `ActionResult`, whose `error` is the operator-facing message.

  **A Decimal column took the whole response down.** `toWireValue` rejected every
  non-plain object, so one Prisma `Decimal` turned a successful list into a 422
  `Validation failed`. A value that declares `toJSON()` has stated how it
  serializes and is now encoded through it; a `Map` or a live database handle still
  fails loudly, and the message names the offending class instead of "object".

- cb7374d: Run every action through one client path, and reject action forms the dialog
  cannot serve.

  The POST-decode-toast-refresh body existed four times — row, bulk, dashboard and
  drawer — and the copies had drifted. `DashboardActionsBar` parsed the response
  with a bare `res.json()`, so a 500 answered by a proxy in HTML threw a parse
  error the operator saw as "Network error" instead of the status line the other
  three showed. Row and bulk checked only `result.ok`, never `res.ok`, so a
  transport failure carrying a non-JSON body reported the generic
  `"<action> failed"` and hid the cause. Only the drawer honoured
  `result.refresh === false`. One `useActionRunner` now serves all four.

  `compileAdmin` refuses an action form field declaring a `reference` or
  function-valued `options`. Action forms are serialized while the page renders, so
  neither could be resolved: the field reached the dialog stripped of its lookup
  and rendered a picker with nothing to pick. Failing at build time with a message
  naming the field beats shipping a control that cannot be used.

- cb7374d: Hand the request to `auth.session`, and stop the demo working around its absence.

  `AuthConfig.session` took no argument, so a provider that needs the request had
  nowhere to get it. The flagship demo forged one —
  `getDemoSession(new Request("http://flowpanel.local/", { headers: await headers() }))`
  — in the very file its footer links to as the config to copy. Any real provider
  modelled on it (`getServerSession(req)`, Lucia's `validateRequest(req)`, a
  host-keyed tenant resolver) would read `flowpanel.local` and pick the wrong
  tenant, origin or cookie policy.

  `session` now receives the request being served. A helper that ignores the
  argument still satisfies the type, so existing configs are unaffected.

  `flowpanel dev` accepts `scripts/board-server.mts` alongside `.ts`. The demo's
  board script is now `.mts` with a static `import { startBoardServer } from
"@flowpanel/kit/bullmq/board"`, replacing a dynamic import inside an `async
main()` that existed only because an ESM-only subpath cannot be required from a
  CJS module.

  The ejected layout template passes `apiBase={config.paths.api}` to
  `FlowpanelGlobals`. Without it every client fetch in an ejected admin — drawer,
  actions, inline edit, import, reference search, SSE — fell back to
  `/api/flowpanel` and 404'd under a custom `paths.api`.

- e0e7b5d: `defineAdmin` now compiles one immutable definition shared by generated pages,
  the v1 JSON API and request-scoped protected controllers. `createFlowpanel`
  binds that definition once and exposes its page, six HTTP handlers, typed
  controllers, serializable client metadata and realtime publisher. Expected
  failures use a stable `FlowpanelResult` envelope with safe codes, messages,
  request IDs and optional field errors.

  Authorization is enforced through one ordered pipeline: admin and resource
  access, operation policy, read-only mode, field read/write policy, tenant
  scope, validation and adapter execution. Drizzle and Prisma operations fail
  closed when a required scope cannot be bound. Post-commit audit, realtime and
  revalidation failures are warnings rather than false mutation failures.

  Forms are conform-based and validated end to end from `FieldDef`. Import and
  export, typed row/bulk/drawer/dashboard actions, soft delete, field-level RBAC
  and empty-field database defaults all use the same hardened write path.
  Realtime frames every SSE message as `{ channel, payload }` and shares one
  EventSource per endpoint/channel pair.

  The generated UI gets an isolated 2026 design system: namespaced light/dark
  tokens, responsive tables and actions, accessible labels and focus behavior,
  an icon registry, chart palette, polished shell and explicit component slots.
  FlowPanel styling no longer depends on or mutates a host application's global
  `.dark` class or root variables.

  The CLI now plans filesystem changes before writing. `init`, `doctor`, `new`,
  `migrate` and `eject` expose machine-readable and dry-run modes where
  applicable; filesystem writes are atomic and rollback-safe, reruns are
  idempotent, and conflicting source files are never overwritten implicitly.
  Migration SQL and bookkeeping now pass through one adapter operation. Drizzle
  splits ordinary multi-statement files, serializes and rechecks applied IDs at
  the database boundary, and uses transactional DDL where the database supports
  it. MySQL statements run individually under an advisory lock, while its
  implicit DDL commits remain explicitly non-rollbackable. `.env.local` and
  `.env` load consistently, diagnostics are concise by default, and the packed
  CLI is tested in clean npm projects on Linux and Windows.
  Custom adapters should add `applyMigration(id, sql)`; the deprecated
  `runMigrationSql` plus `markMigrationApplied` pair remains a warned, non-atomic
  upgrade fallback.

  The canonical ScrapeAI demo is a focused seven-screen competitive-price
  intelligence story with deterministic relational data, Admin/Support personas,
  a responsive operations dashboard and human review workflow. The synchronized
  documentation covers every public export, separates generated-UI compatibility
  responses from the structured v1 protocol, and is verified against source in
  CI.

  Breaking: the supported framework baseline is Next.js `^16.3.0`; `Tone`
  replaces per-surface tone vocabularies; `useAdminMutation` drops the unused
  `optimistic` option; and SSE consumers must read the channel envelope instead
  of a bare payload. The optional chart runtime is an explicit peer of
  `@flowpanel/next`, so strict package managers resolve dashboard charts instead
  of silently rendering a missing-package fallback.

- 52606de: Fix the release-blocking gaps found reviewing 0.2.0.

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

- 52606de: Collapse three implementations this release had duplicated across packages.

  `formatColumnValue` is new in `@flowpanel/core`: the pure `money` / `number`
  half of `ColumnDef.format`, previously copied verbatim into
  `@flowpanel/react`'s `formatNumericCell` and `@flowpanel/next`'s
  `formatNumericValue` because react ships behind a `"use client"` banner a
  server component cannot call into. Core has no banner, so both sides now
  import the one function and keep only their own badge JSX. The copies had
  already started to diverge on the badge tone lookup — `typeof format ===
"object"` on the client versus an extra `format.kind === "badge"` re-check on
  the server. The re-check was unreachable dead weight (the enclosing guard
  already admits only `"badge"` and `{ kind: "badge" }`), so both sides keep the
  client's form, and a parity test pins that the two renderers resolve the same
  status and tone for the same input.

  `SelectOption` → `{ label, value: String(value) }` was re-implemented at five
  places inside `@flowpanel/next` — resource form fields, row/bulk action form
  fields, dashboard action form fields, list filter specs, and the drawer's
  string-only variant. That `String(value)` is the wire contract clients
  round-trip back through filters and form submissions, so it now lives in one
  helper the five sites call. Only the list-filter async branch changes at all:
  it used to skip the string shorthand its declared type forbids, and now
  accepts it like everywhere else.

  Action dialogs render through the canonical `FormField` control set. A row,
  bulk, dashboard or drawer action declaring `form: [{ name, type }]` used to go
  through the dialog's own control chain, which handled textarea / select /
  multiselect / boolean / tags and fell everything else through to a plain text
  input — so `reference`, `json`, `radio` and `markdown` fields silently
  rendered as text boxes in an action dialog while rendering their real controls
  in a resource form. They now render identically in both places, backed by the
  new `StandaloneFormFields` provider in `@flowpanel/react`, which supplies
  those controls with the context they need outside a schema-driven `<Form>`.

  Two consequences of that switch are worth knowing. `required` on an action
  form field now marks the control `aria-required` instead of setting the native
  `required` attribute, matching how a resource form marks it — the field is
  still enforced server-side by the action's `input` schema. And a `json` field
  submits the JSON text the editor holds, the same string a resource form posts
  for a json column, rather than a parsed object.

### Patch Changes

- 0c83f68: Decide a list page's field access once, not once per row.

  `fieldAccess.read` may be a predicate, and it may be async — a role lookup, a
  feature flag, a query. The rendered list page and the JSON list route resolved
  it separately for the list controls and then again for every row returned, so a
  50-row page ran the same policy 51 times and the two decisions could in
  principle disagree. `resolveReadableListSurface` now resolves the union of the
  list controls and the projected row fields in one pass and hands back both sets,
  derived from the same result. The control allowlist is unchanged: a row-only
  field still cannot be filtered or sorted on.

- 12fdd08: Unknown-route 404s answer in the result envelope.

  The catch-all handlers and `notFoundResponse` returned `{ error: "not found" }`
  with a bare string, which `@flowpanel/client` could not recognise — an unknown
  resource surfaced as `internal` / "Unexpected response from Flowpanel." instead
  of `not_found`. All 404 bodies are now
  `{ ok: false, error: { code: "not_found", message } }`.

- cb7374d: Stop the build racing itself into a package with no typings.

  `@flowpanel/charts`, `@flowpanel/next` and `@flowpanel/react` each build two
  tsup configs concurrently, and in each the first config declared `clean: true`.
  Whichever finished first had its output deleted by the other — which is how
  `@flowpanel/next` came to ship `client.js` with no `client.d.ts`, leaving
  `@flowpanel/kit` unable to typecheck its own `./next/client` re-export. The
  build now clears `dist` once before tsup starts, the way `@flowpanel/core`
  already did.

- cb7374d: Give pagination limits a single owner.

  `ResourceController.list` already clamped `pageSize`, so the JSON route's own cap
  was a second limit that disagreed with it — and lost, since the controller runs
  last. The route passes the requested values through and the controller clamps
  both: `pageSize` to its existing maximum, and `page` to 100 000, which the
  programmatic API previously did not bound at all.

- cb7374d: Dispatch routes from a table, and build the action context once.

  `handlers()` matched eleven routes by hand, each repeating a length check, a
  segment comparison, a destructure and a guard. The two GET copies answered a
  malformed route with `{ error }` while the nine POST copies answered
  `{ ok: false, error }` — the same failure in two shapes, one of them missing the
  `ok` field every client tests. A pattern table replaces them and answers in one
  shape.

  The nine-line action context — request, database, `unsafe.db`, actor id,
  publisher — was rebuilt inline by all four action routes. It is now
  `buildActionContext`.

- cb7374d: Collapse helpers that existed in more than one copy. No behaviour changes.

  Six routes hand-wrote the 404 that `notFoundResponse` already produces, so
  their bodies drifted from its terse shape and skipped its development-mode
  server log naming the registered resources. They call the helper now.

  `findPropertyByName` and `asStringLiteral` were declared three and two times
  across the lint rules; both live in `ast-utils`.

  `@flowpanel/react` re-exports `NumericFormat` and `Tone` from `@flowpanel/core`
  rather than mirroring the unions, so adding a variant in core can no longer leave
  the two vocabularies disagreeing. The import is type-only and keeps the client
  bundle free of core's runtime.

- 12fdd08: `request().dashboard(path).action(...)` reaches its dashboard again.

  The controller validated the path against the registry, then handed the raw
  path to a route that decodes an encoded one — so every delegated dashboard
  action 404'd. The controller now encodes before dispatch, and the encoding is
  injective: a path containing literal underscores (`/a__b`) no longer decodes
  into a different dashboard's path. The controller path is covered by a test
  for the first time.

- efc7e36: Build every package with the same script, and drop unused dev dependencies.

  `core`, `next`, `react` and `charts` cleaned `dist` with a shell
  `rm -rf dist && tsup`, which fails on Windows — a contributor there could not
  run `pnpm build` at all. The multi-config packages clear `dist` once from the
  config module instead, and every package's build script is now plain `tsup`.

  `testcontainers` was declared by both adapters but imported by neither (the
  `@testcontainers/postgresql` and `@testcontainers/mysql` modules bring it
  themselves), `pg` and `@types/pg` were declared by the Drizzle adapter whose
  PostgreSQL tests use `postgres`, and `@typescript-eslint/parser` was declared by
  the ESLint plugin, which reaches it through `@typescript-eslint/rule-tester`.

- 12fdd08: Hold every write and render path to the rules the main paths already follow.

  - Inline cell edits validate against the resource's declared `schema`, exactly
    like form edits and JSON `PATCH`; previously only the adapter-inferred schema
    applied to them.
  - The list page's create drawer offers only writable columns, matching the
    standalone create page; generated and primary-key columns no longer appear
    in the form the server would then reject.
  - The audit `targetId` and realtime `id` of a create honour `rowKey` instead
    of assuming a column named `id`.
  - `RestoreButton` URL-encodes the resource and id like every other client
    call, and reads the error message from the result envelope.
  - The SSE stream route maps failures to their real status — a crashing session
    provider is a 500 and a rate limit a 429, reported through `hooks.onError`,
    instead of a silent 403.
  - Saving a view under an existing name replaces that view instead of creating
    a duplicate that rendered with colliding keys and deleted in pairs.
  - Body rows carry `aria-rowindex` offset past the header row and the table
    declares `aria-rowcount`, so screen readers announce absolute positions
    across pages.

- Updated dependencies [12fdd08]
- Updated dependencies [52606de]
- Updated dependencies [f54f815]
- Updated dependencies [12fdd08]
- Updated dependencies [4157802]
- Updated dependencies [12fdd08]
- Updated dependencies [cb7374d]
- Updated dependencies [cb7374d]
- Updated dependencies [e0e7b5d]
- Updated dependencies [52606de]
- Updated dependencies [52606de]
- Updated dependencies [cb7374d]
- Updated dependencies [cb7374d]
- Updated dependencies [efc7e36]
- Updated dependencies [52606de]
  - @flowpanel/core@0.2.0
  - @flowpanel/react@0.2.0

## 0.1.0

First public release. The Next.js App Router integration: the admin page component, API route handlers, server-rendered list/detail/dashboard pages, drawers, server actions (row / bulk / dashboard / inline), and SSE realtime.
