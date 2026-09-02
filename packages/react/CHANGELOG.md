# @flowpanel/react

## 0.2.0

### Minor Changes

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

- 12fdd08: Field types render the control their name promises.

  `type: "switch"` now renders the shipped `Switch` toggle with checkbox form
  semantics; it previously fell back to a plain checkbox, leaving the component
  named after the type unreachable. Introspected enum columns render as a select
  of their values instead of a free-text input.

  Also removed what nothing could reach: the `DateRangePicker.allowCustom` prop
  that was declared and ignored, an unexported `CopyButton`, and the
  `fp-anim-sheet-top`/`-bottom` animation classes no element used (the CLI's
  `admin.css` templates mirror the removal). `useTheme.setTheme` writes through
  the shared storage helper instead of a hardcoded key, and the Drizzle CSV
  export helper neutralises leading formula sigils the way the built-in list
  export always has.

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

- cb7374d: Stop the build racing itself into a package with no typings.

  `@flowpanel/charts`, `@flowpanel/next` and `@flowpanel/react` each build two
  tsup configs concurrently, and in each the first config declared `clean: true`.
  Whichever finished first had its output deleted by the other — which is how
  `@flowpanel/next` came to ship `client.js` with no `client.d.ts`, leaving
  `@flowpanel/kit` unable to typecheck its own `./next/client` re-export. The
  build now clears `dist` once before tsup starts, the way `@flowpanel/core`
  already did.

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

- Updated dependencies [12fdd08]
- Updated dependencies [52606de]
- Updated dependencies [f54f815]
- Updated dependencies [4157802]
- Updated dependencies [12fdd08]
- Updated dependencies [cb7374d]
- Updated dependencies [cb7374d]
- Updated dependencies [e0e7b5d]
- Updated dependencies [52606de]
- Updated dependencies [52606de]
- Updated dependencies [cb7374d]
- Updated dependencies [efc7e36]
- Updated dependencies [52606de]
  - @flowpanel/core@0.2.0

## 0.1.0

First public release. UI primitives for FlowPanel — shadcn-style components on Radix + Tailwind v4 with design tokens: the admin shell, data table, forms, feedback, and dashboard widgets.
