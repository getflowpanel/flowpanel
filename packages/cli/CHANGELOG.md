# @flowpanel/cli

## 0.2.0

### Minor Changes

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

### Patch Changes

- 52606de: Fix scaffolding and dry-run defects across the CLI.

  `migrate --dry-run` no longer opens a database connection. It previously called
  the adapter's `listAppliedMigrations()` before the dry-run branch, and the
  drizzle adapter's implementation issues `CREATE TABLE IF NOT EXISTS
_flowpanel_migrations` — a dry run wrote to the database. It now returns after
  reading the migration directory and states plainly that applied state is
  unknown without a connection.

  `init` pins `@flowpanel/kit` and `@flowpanel/cli` to the CLI's own minor instead
  of installing them unpinned, so templates cut for one version can no longer land
  next to a kit from another. A kit/CLI minor mismatch is now a hard stop in
  `init`, `doctor` and `eject`, checked before any template is written, naming
  both versions and the upgrade command.

  When no auth module is detected, `init` scaffolds a clearly-marked development
  `getSession` stub at the path its config imports, instead of writing an import
  that resolves to nothing and letting the next printed step die on it.

  Also: the missing-`DATABASE_URL` hint now walks the `cause` chain, so it fires
  through drizzle's `Failed query:` wrapper; `doctor --fix --dry-run` prints its
  plan in human mode; `doctor --fix` refuses to scaffold outside a FlowPanel
  project; `doctor` runs its eject-marker check and surfaces the first `tsc`
  diagnostics; `doctor` says Next.js is missing rather than offering an upgrade;
  `migrate` uses the detected package manager instead of hardcoding `pnpm dlx`;
  `new` rejects an unknown `--kind` instead of coercing it to drizzle, and drops
  the "add `resource` to the import above" instruction it has just carried out.

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

- 12fdd08: Generate the code the documentation teaches, in every environment.

  - `flowpanel new` writes `resource(schema.orders, {})` — the DSL lists every
    introspected column until narrowed — instead of `{ columns: ["id"] }`, and
    no longer erases Prisma ref typing with `resource<unknown>`.
  - The install spinner renders only on a TTY; piped and CI runs get plain log
    lines instead of kilobytes of ANSI redraw frames.
  - `eject` with an unknown target and `migrate` without a config answer in JSON
    when `--json` is set, like every other failure path.
  - With no path alias and the App Router under `src/app`, the scaffolded layout
    imports `admin.css` from the right depth instead of a nonexistent path.
  - The ejected create-page hint names the export `actions.ts` actually has.

## 0.1.0

First public release. The FlowPanel CLI: `init`, `dev`, `migrate`, `doctor`, `eject`, and `new`.
