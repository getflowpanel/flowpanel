# FlowPanel → 10/10: what a real admin taught us

**Source of truth:** the `freelance-radar` admin on `feat/new-admin` (4 commits,
3 weeks of dogfooding on Next 16 + Drizzle + better-auth + pnpm + Tailwind 4),
plus the F1–F43 friction log. Every claim below was measured on that branch or
verified in FlowPanel 0.2.0 source. Nothing here is a wish list; each item is a
place where the framework made the author write code, guess, or work around it.

---

## 1. What the admin actually became

| Measure | Value |
| --- | --- |
| Host-side admin code (no tests) | 6 133 LOC in 70 files |
| Dashboard widgets: `custom()` / `metric()` / charts / `table()` | 22 / 12 / 5 / **0** |
| Column definitions with `render:` / with `format:` | 63 / 4 |
| Columns declared `hidden: true` only to feed drawers and detail tabs | 23 |
| Date cells wrapped in `whitespace-nowrap tabular-nums` by hand | 15 |
| Query modules written in raw SQL through `db.execute` | 20 files, 1 700 LOC |
| Own UI primitives reimplemented (Panel, Stat, Rows, Empty, QueryTable, Sparkline) | 6 |
| Own infrastructure reimplemented (theme script, realtime wire format, session enrichment, SQL param sanitiser) | 4 |

FlowPanel delivered the shell, navigation, lists, search, filters, saved views,
export, drawers, row actions, the auth gate, rate limiting and audit. That is
real value and it worked on the first try once mounted. But of the code the
host had to write, roughly two thirds exists because of a **framework gap**,
not because of the domain:

- **Genuinely domain-specific (keep):** funnel definitions, priorities ranking,
  pipeline trace, health assessment, user card queries. ~2 000 LOC.
- **Workarounds for missing primitives or bugs (should not exist):**
  every `custom()` that is a stat card, a bar list, a KV panel or a small
  table; every `render:` that only formats a date, a boolean, a money value
  or a badge; every `hidden` column that exists to give a drawer field a
  label; every hardcoded `/new-admin/...` href; the SQL sanitiser; the layout
  that re-implements the theme script; the realtime wire format; the
  `session()` that enriches the role. ~4 000 LOC.

Not one `table()` widget survived. The built-in one ignores `emptyState`,
takes bare keys as columns, and cannot link a row anywhere, so all six
dashboard tables were rewritten on a 71-line `QueryTable`.

**Verdict:** FlowPanel is a good CRUD shell with an analytics story that stops
at `metric()` and charts. Every step beyond that — an entity card, a founder
dashboard, a localized product — falls off the DSL into React.

---

## 2. The journey, stage by stage

The bar for 10/10 at each stage is the same: **a developer (or an agent) does
the obvious thing and it works; when it does not, the tool says why.**

### Stage 0 — install (`pnpm dlx @flowpanel/cli init`)

**Where it stands.** On freelance-radar `init` produced a config that could not
compile and a route that made `next dev` refuse to boot. Eleven of the
forty-three friction items are here (F1–F10, F17, F20, F34). Root causes:

1. Detection is a list of hardcoded file paths (`detect.ts`), so an FSD layout
   or `db/index.ts` + `schema/index.ts` matches nothing. `drizzle.config.ts`,
   which names the schema path exactly, is never read. Guesses are shown as if
   detected (F1) and never validated (F2).
2. The mount path is hardcoded to `app/admin/[[...slug]]`; an existing `/admin`
   collides fatally (F3). `paths.admin` exists in config but `init` never
   sets it, and `doctor` never reads it (F17).
3. `init` edits the **root** layout: CSS import, `suppressHydrationWarning`,
   an inline `<ThemeScript/>` without nonce (F5, F30). On a site with CSP the
   script is blocked in production; on a site with its own theme script there
   are now two.
4. `admin.css` re-imports Tailwind (F6) and its `@source` globs do not expand
   under pnpm, so **zero** FlowPanel utilities are generated (F34, measured:
   0 rules vs 439). Every pnpm host gets a broken grid.
5. Auth: five file paths are probed; better-auth / NextAuth / Clerk /
   Lucia as **dependencies** are not. A stub that signs everyone in as admin
   is written next to a real provider (F4). The template's `role: (s) =>
   s.user.role` returns `"guest"` for every provider that keeps the role in
   the database, with no diagnostic (F11).
6. `flowpanel migrate` does not load `.env` (F7), swallows the cause
   (F8), prints raw Postgres NOTICE objects (F9).
7. The prerequisite gate demands Next `^16.3` and the bump cost the host a
   working `experimental.viewTransition` (F20).
8. The interactive flow asks *"Drizzle db client path"* as free text. That is
   an expert question presented to someone who wants an admin.

**What 10/10 looks like.**

- `init` becomes **scan → plan → confirm → apply**, one confirmation. The scan
  reads `package.json` deps (ORM, auth library, Tailwind major, pnpm),
  `tsconfig` paths, `drizzle.config.ts` / `prisma/schema.prisma`, the App
  Router tree (existing routes, `layout.tsx`, `middleware.ts` / `proxy.ts`),
  the global CSS entry. Every value in the plan is marked **detected** or
  **guessed**, and every guessed path is resolved on disk before anything is
  written. A failed resolution is a question, not a broken config.
- The mount path is a plan field with collision detection. If `/admin` is
  taken the plan proposes the next free one and writes `paths.admin`.
  `doctor` reads the same config value.
- **Never touch the root layout.** Scaffold `app/<mount>/layout.tsx` with its
  own CSS import and a theme script that takes the nonce from a documented
  hook (`themeScript({ nonce })`, server-safe). The root layout is the host's.
- Ship **prebuilt CSS**: `@flowpanel/kit/styles.css` with all utilities
  compiled, plus the token layer. Tailwind on the host becomes optional. For
  hosts that want tokens in their own Tailwind, keep `admin.css` but list
  every package `dist` explicitly — no `*` globs.
- Auth **presets** keyed on the detected dependency: `withBetterAuth({ auth,
  role: async (userId) => ... })`, `withNextAuth`, `withClerk`, `withLucia`.
  `AuthConfig.role` accepts an async function. A dev-mode banner shows the
  resolved role when access is denied ("session found, role resolved to
  `guest`, `admin` required").
- CLI loads `.env` / `.env.local` the way Next does, surfaces the error
  cause chain, silences NOTICEs unless `--verbose`. Prerequisite is a
  range the CLI checks against installed versions, not a forced bump.
- `doctor` checks what actually broke on a real host: mount path from config,
  env present, DB reachable, **CSS utilities generated** (probe one class),
  middleware allowlist includes the mount, auth returns a role for the current
  dev session, `?tab=` links, realtime driver bound.
- `dev` either goes away or earns its place: runs `doctor` first, prints the
  admin URL, opens the browser. Today it is `next dev` with a prefix.
- **The config starts full, not empty.** `init` introspects the schema
  (`migrate` already loads the config through jiti, so the CLI can load the
  schema) and offers a multiselect of tables. Each chosen table gets sensible
  defaults: first five scalar columns, text search on varchar columns, a
  daterange filter on `createdAt`, `defaultSort` by it. "Navigation is empty"
  is the #1 troubleshooting entry because of a deliberate blank array.
- **CI dogfood** on a freelance-radar-shaped fixture (FSD tree, better-auth,
  middleware allowlist, CSP nonce, existing `/admin`, pnpm, Tailwind 4 in
  `globals.css`). Spec §0.7 planned it; it would have caught F3, F5, F10, F34
  before release.

### Stage 1 — first resource

**Works:** list, search, sort, pagination, filters, saved views, export,
drawer, row actions, bulk actions, import, field RBAC, read-only mode.

**Gaps.** `SELECT *` despite `columns` (F12) — a single dropped column 500s the
page, and the error escapes to the host's error boundary with no resource
name (F13). Rows announce "Enter opens" but open nothing unless `rowClick:
"drawer"` is set, and the detail page cannot be reached at all from the UI
(F14, F33). "Edit Orders" for one row (F15). Required-field messages are raw
Zod (F18). A resource whose required column is outside `columns` cannot be
created and nothing warns (F19).

**10/10.** `rowClick: "detail" | "drawer" | false`, default `"detail"` when
`detail` is configured. Projection follows `columns` (plus `rowKey`, plus
what drawers and tabs declare — see F31). A dev error surface that names
the resource, the operation and the SQL. `defineAdmin` warns at compile time
when `create` is enabled but a non-nullable column has no form field.
Humanized validation messages through `labels`.

### Stage 2 — making it readable (labels, locale, formats)

**Gaps.** `LabelsConfig` covers maybe half the chrome. Hardcoded English
remains in: search placeholder (F40), "All" / "Any" in filters (F26), date
presets ("Last 30 days"), "Save view…", "N results", "Rows per page",
"Edit", "Page not found", "No related rows", "No data", nav group headings
"DASHBOARDS / RESOURCES / PAGES". Dates are fixed `YYYY-MM-DD HH:mm` UTC and
numbers are `en-US` grouped (F27). A fully Russian admin says "Search
Пользователи…".

This is why 63 columns have `render:` and only 4 have `format:`. There is no
date format, no money format, no locale, so every date column in the host
wraps `dt()` in a nowrap span by hand — fifteen times.

**10/10.**

- `defineAdmin({ locale: "ru-RU", timeZone: "Europe/Moscow" })` drives every
  `Intl` call: dates, relative times, numbers, currency, date presets.
- `LabelsConfig` is **complete** and enforced: a test walks
  `packages/react` and `packages/next` for string literals inside JSX and
  fails on any that does not come from `labels`. Add the missing keys:
  `filters.any/all`, `dateRange.presets.*`, `views.save`, `table.results`,
  `table.rowsPerPage`, `detail.edit`, `notFound.*`, `related.empty`,
  `widget.empty`, `nav.groups.*`.
- Built-in `ColumnFormat`s that cover the 63 renders:
  `date`, `datetime`, `relative`, `money({ currency })`, `number({ unit,
  digits })`, `boolean`, `badge(map)`, `enum(map)`, `link({ href })`,
  `truncate(n)`, `reference` (already). `format` composes with `align` and
  `width` so a date column is one line.
- `plural`/`singular` used consistently ("Edit Order").

### Stage 3 — the entity card (detail page)

This is where the host wrote the most code: 10 tabs on the user card, 6 on
the order card, all custom. What was missing:

- `detail.header` is declared and dead; the title is always `Label · <uuid>`
  (F22, F43). A founder looking at a user sees a UUID, not an email.
- `render(row)` receives the row **projected to declared columns** — a
  custom tab that needs `bio` has to declare a hidden `bio` column, which
  then leaks into the list query and the related tabs (F29, F31). Hence 23
  hidden columns.
- Every tab renders eagerly on the server (F37): the 10-tab user card runs
  ten sets of queries on every load, then hides nine of them client-side.
- The doc says the tab key is a URL fragment; the runtime uses `?tab=`
  (F38). Links written against the doc silently do nothing.
- Related-resource tabs: 25 rows, no pagination, no sort, no filter, no "see
  all", raw UUIDs in reference columns, the parent FK column cannot be hidden
  (F24, F39).
- No primitive for the two things every entity card is made of: **a grid of
  stat cards** and **grouped key/value fields**. The host wrote `Stat`,
  `Rows`, `Row`, `Panel`, `Empty`.

**10/10.**

- `detail: { title: (row) => string, subtitle?: (row) => string, badge?:
  (row) => { label, tone } }`. Delete `header` or make it this.
- Tabs are **lazy**: only the active tab renders on the server; switching
  fetches the tab through the existing API route and streams it. `?tab=`
  documented as the contract.
- `render(row, ctx)` receives the **full authorized row** and `ctx` with
  `db`, `dateRange`, `href()`, `labels`. Projection for the list stays
  `columns`-only.
- Related tabs are a **real DataTable**: pagination, sort, filters, reference
  labels resolved, `hide: ["userId"]`, and a "Open list →" link that carries
  the filter as `?f_userId=`.
- Detail tabs accept the **same widget grid dashboards use**:
  `{ key, label, widgets: [stat(...), kv(...), table(...), custom(...)] }`
  with `ctx.row` available to every query. One widget model, two hosts. The
  user "Обзор" tab (identity panel, six stat cards, settings groups) becomes
  config.
- `fields` tabs accept groups: `sections: [{ label: "Фильтры ленты", fields:
  ["categories", "budgetMin", ...] }]`, each field with its own `label` and
  `format` (F29 fixed at the source: `FieldDef.label` is serialized).

### Stage 4 — dashboards

**Gaps.** `metric()`'s `tone` and `sublabel` are static; the data cannot say
"this is red". `delta` is always green-and-up. `table()` ignores
`emptyState`, takes bare keys, cannot link rows, has no `limit`/"see all"
(F21). Charts render an empty rectangle for `[]` (F41) and a legendless
donut by default (F42). No refresh interval or freshness stamp (F32). No
skeleton, so every load shows framed empty boxes for one to two seconds.
Links are hand-typed `"/new-admin/user"` strings; renaming the mount breaks
every dashboard. The same query runs once per widget unless the host wraps
it in React `cache` by hand (the overview does this for four queries).

**10/10.**

- `metric(label, query, opts)` where `query` may return a number **or**
  `{ value, tone, sublabel, delta: { value, goodWhen: "up" | "down" }, href }`.
  Tone follows the data. The 50-line `ValueCard` disappears.
- `table()` gets typed columns `{ field, label, format, align, width }`,
  `rowHref: (row) => string`, `emptyState` honored, `limit` + `seeAll: href`.
  All six host tables become config.
- New small widgets that every analytics admin needs, each ≤ 80 LOC in
  `@flowpanel/react`: `stat` (label / value / hint / href, the thing that
  appeared 12 times), `kv` (grouped key/values), `bars` (label + value +
  share, horizontal), `funnel` (steps with share and drop-off), `list`
  (rows with tone dot, text, meta, href). These cover 18 of the 22 `custom()`
  widgets on the host.
- Every widget has `emptyState` and a skeleton; charts show "Нет данных"
  from `labels`. Pie defaults to legend on.
- `ctx.href(resource, id?, { filter, tab })` — typed, mount-aware links.
  `drilldown` accepts the same helper.
- `dashboard({ refresh: "60s" })` and a freshness stamp in the section
  header ("обновлено 12 с назад").
- Per-request query dedupe: `ctx.query(key, fn)` or automatic `cache()`
  around widget queries.
- `dateRange.previous()` and `series.fillDays(rows, range)` helpers: every
  growth metric on the host computes the previous period and zero-fills a
  daily series by hand.

### Stage 5 — realtime and infrastructure

**Gaps.** `createRedisPublisher` opens ioredis without an error handler and
opens pub+sub in publish-only processes (F23). The publisher binds once per
process and never re-binds on HMR (F35): a dev server started before the
driver was configured stays on `memory` for its life with no diagnostic.
Publishing from a worker means reimplementing the `{channel, payload}`
envelope by hand (F36). `ThemeScript` cannot take a nonce and
`buildThemeInitScript` is `"use client"` (F30); the host copied the script
verbatim into its layout.

**10/10.**

- `@flowpanel/kit/publish`: a dependency-free `createPublisher({ redis:
  hostClient | url, keyPrefix })` that accepts the host's guarded ioredis
  instance, exposes `publish(channel, payload)` and `channelFor(resource)`,
  and owns the envelope. Workers import this, nothing else.
- `.on("error")` on every Redis connection; publish-only processes open one
  connection.
- HMR-safe binding keyed on the config id; a dev log line when the driver is
  `memory` while `REDIS_URL` is set.
- `themeScript({ nonce, defaultMode })` server-safe; `ThemeScript` accepts
  `nonce`.

### Stage 6 — analytics queries

**Gaps.** Twenty query files in raw SQL through `db.execute`, each going
through a hand-written sanitizer because drizzle 0.45 × postgres-js rejects
`Date` params (F28). Every file re-implements `num()`, `at()`, `rows()`.

**10/10.** `ctx.sql\`...\`` from the adapter: parameters sanitized, naive
timestamps parsed to UTC, rows typed by a generic. `ctx.count(table, where)`
and `ctx.series(table, { dateField, bucket, range })` for the two shapes that
cover most dashboard metrics. Keep it small; raw SQL stays available.

### Stage 7 — verification

**Gap.** The host wrote its own Playwright sweep (every route 200, zero
console errors, no English placeholders, no ISO dates, no horizontal scroll)
because nothing in FlowPanel offers one.

**10/10.** `@flowpanel/test` with `smokeAdmin(page, { cookie })`: walks nav,
opens each resource, drawer and detail, asserts status, console, a11y, and
that no string outside `labels` leaked. `flowpanel doctor --e2e` runs it.

### Stage 8 — the author is an agent

The freelance-radar admin was written by Claude Code; the owner would not
have got past `init` alone. For an agent, a framework is 10/10 when it is
**legible**: the docs match the runtime, the errors name the fix, and the
right primitive is findable.

**Gaps.** Doc-vs-runtime drift (F38 tab fragment vs `?tab=`; F22 documented
`header` that does nothing; `charts.mdx` once documented a nonexistent
options API). Type-level options that are ignored at runtime (`emptyState`
on `table()`). Three names for the same thing across packages. No single
file an agent can read.

**10/10.**

- `llms.txt` / `AGENTS.md` shipped **inside** `@flowpanel/kit`: the whole
  DSL on one page with one example per option, kept in sync by a test that
  extracts `@example` blocks and type-checks them.
- **Docs contract test:** every documented option is exercised in at least
  one test; every exported option type has a runtime consumer (knip-style
  check over `packages/core/src/types`).
- Errors are deterministic and include "did you mean" for resource, column,
  filter and tab keys. `doctor --json` for agents.
- An `examples/founder-dashboard`: the analytics shape (growth, funnel,
  lifecycle, entity card with stat grid and related tabs), not only CRUD.
  Today `ai-scraper` is the only reference and it is operator-shaped.

---

## 3. Priorities — score per hour

| Tier | Scope | Why first |
| --- | --- | --- |
| **1. "I could not start"** | init scan/plan/validate, mount collision, own admin layout, prebuilt CSS, auth presets + async role, `.env` + causes in CLI, doctor reading config, CI dogfood fixture | Every user hits this on minute one. Nothing else matters if `init` breaks `next dev`. |
| **2. The 4 000 LOC** | locale + complete labels + built-in formats; detail title / lazy tabs / full row / widgets-in-tabs / real related tables; dynamic metric, typed `table()`, `stat`/`kv`/`bars`/`funnel`/`list`, empty states + skeletons, `ctx.href`, range helpers | Turns "FlowPanel for CRUD, React for everything else" into "FlowPanel for the admin". |
| **3. Infra** | `kit/publish`, error handlers, HMR-safe binding, nonce-aware theme script, `ctx.sql` | Each is a day; each removed a hand-copied file on the host. |
| **4. Legibility** | llms.txt in the package, docs-contract test, did-you-mean errors, founder example, `@flowpanel/test` | Makes the next agent-written admin take a day, not three weeks. |

Effort at the granularity of the existing 1.x spec: Tier 1 ≈ 60 h, Tier 2 ≈
120 h, Tier 3 ≈ 25 h, Tier 4 ≈ 40 h.

---

## 4. What freelance-radar would look like after

| File / concern | Now | After |
| --- | --- | --- |
| `admin/ui/primitives.tsx`, `QueryTable.tsx`, `ValueCard.tsx`, `Sparkline.tsx` | 322 LOC | 0 — `stat`, `kv`, `table`, metric sparkline |
| `admin/ui/tables.tsx`, `UserRelated.tsx`, `Lifecycle.tsx`, `ScoringQuality.tsx`, `OnboardingFunnel.tsx`, `Subscriptions.tsx` | 630 LOC | ~80 — `table`/`bars`/`funnel`/`list` config |
| `admin/ui/UserOverview.tsx`, `UserSettingsPanel.tsx`, `OrderOverview.tsx` | 366 LOC | ~120 — `stat` grid + `fields.sections` + widgets in tabs |
| `admin/format.ts`, `cells.tsx` | 259 LOC | ~60 — domain label maps only |
| `admin/queries/sql.ts`, `src/app/new-admin/layout.tsx`, `adminRealtime.ts`, `config/auth.ts` | 150 LOC | ~15 — `ctx.sql`, scaffolded layout, `kit/publish`, `withBetterAuth` |
| 23 `hidden` columns, 63 `render`, 15 nowrap wrappers | — | ~0, ~15, 0 |
| **Total host admin code** | **6 133 LOC** | **≈ 2 800 LOC**, all of it domain: funnels, priorities, health, pipeline trace, user card queries |

The remaining code is the product's own analytics. That is the right
boundary: FlowPanel owns *how an admin looks and behaves*, the host owns
*what the business needs to know*.

---

## 5. The one-sentence version

FlowPanel 0.2 is a strong CRUD shell whose install breaks on real projects and
whose DSL ends at the list page; 10/10 is an `init` that cannot produce a
broken app, a detail page and dashboard model rich enough that a founder
admin is config, and a package an agent can read end-to-end without guessing.
