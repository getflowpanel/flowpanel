# @flowpanel/core

## 0.2.0

### Minor Changes

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

- 52606de: Delete modules and types no surface reached, before 0.2 freezes them.

  `Sheet` and `Tooltip` are gone from `@flowpanel/react`. Both were complete
  Radix primitive families that FlowPanel itself never rendered — the shipped
  slide-over is `Drawer`, and nothing anywhere drew a tooltip. Removing the
  tooltip family also drops `@radix-ui/react-tooltip` from the install. The
  `Dialog`, `Popover`, `Select` and `DropdownMenu` families are untouched: they
  are used, and trimming individual members would leave a documented primitive
  set that cannot be composed.

  `AdapterCapabilities` and `AdapterV2` are gone from `@flowpanel/core`, along
  with the optional `Adapter.capabilities` field and the
  `capabilities: { version: 2 }` literal both shipped adapters wrote. Nothing
  ever read the value; a version marker no runtime consults is not a contract. `bindAdapterScope`
  and `BoundAdapterScope` — the parts of that module that carry real meaning —
  stay, and now live in `types/bound-scope.ts` rather than a file named after a
  type that no longer exists.

  Internally: `@flowpanel/adapter-bullmq` no longer declares `@flowpanel/core` as
  a dependency it never imported, an orphaned `Kbd` component is deleted, four
  guard helpers superseded by `withGuards` are removed from `@flowpanel/next`, and
  the chart tick formatter's six-case switch collapses to the two-way branch it
  always was.

- cb7374d: Give the fail-closed scope rule one definition.

  Both first-party adapters resolved the bound tenant predicate themselves, with
  the same fallback chain and the same refusal — down to an identical two-line
  message. A hardening change to either was invisible to the other, and a
  third-party adapter had only prose to copy from.

  `resolveScopeApplier(ctx)` in `@flowpanel/core` is now that rule: it returns the
  bound predicate, `null` when the resource declares no scope, and throws
  `FlowpanelAccessError` when a scope is required but absent. Both adapters call
  it, and `docs/reference/runtime-contracts` states the obligation for anyone
  writing a third.

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

- 12fdd08: Say only true things in the config surface.

  `useAdminMutation`'s `rollbackOn` documented a rollback strategy the hook
  never implemented — it is gone, and the hook's documentation now says what it
  wraps: any async action returning an `ActionResult`, not a Server Action.
  `AdminDefinition.id`'s docstring now names where the value actually goes (the
  wire client metadata) instead of promising diagnostics and logs that never
  read it. `AuthConfig.allowUnauthenticated`'s docstring states the real
  production rule: without `requireRole`, production refuses to start unless it
  is `true` and the admin is `readOnly`.

- 12fdd08: Reject migration SQL that would silently break the adapter's own guarantees.

  Drizzle's `applyMigration` wraps a file's statements and the applied-marker in
  one transaction, yet a `COMMIT` inside the file sailed through and split that
  boundary without a word. Both adapters now share one policy, exported from the
  core-internal SQL lexer: client directives (`DELIMITER`, `SOURCE`, psql and
  sqlite dot commands, `GO`) and transaction-control statements are refused
  loudly before any SQL runs. Previously the two adapters had drifted — Prisma
  refused what Drizzle accepted.

- cb7374d: Stop the build racing itself into a package with no typings.

  `@flowpanel/charts`, `@flowpanel/next` and `@flowpanel/react` each build two
  tsup configs concurrently, and in each the first config declared `clean: true`.
  Whichever finished first had its output deleted by the other — which is how
  `@flowpanel/next` came to ship `client.js` with no `client.d.ts`, leaving
  `@flowpanel/kit` unable to typecheck its own `./next/client` re-export. The
  build now clears `dist` once before tsup starts, the way `@flowpanel/core`
  already did.

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

## 0.1.0

First public release. Core types and runtime for FlowPanel: `defineAdmin`, the `resource` / `dashboard` / widget builders, and the runtime for tenant scope, role gates, audit, and rate limiting.
