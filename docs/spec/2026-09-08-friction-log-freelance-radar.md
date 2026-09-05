# FlowPanel 0.2.0 on freelance-radar — friction log (F1–F43)

Verified defects and gaps found by running FlowPanel 0.2.0 on a real pnpm + Next 16 + Drizzle + better-auth host. Companion to `2026-09-08-10-of-10-from-freelance-radar.md`. F16 was folded into F14.

## F1 db/schema paths: guessed, presented as detected
detect.ts firstMatch() = hardcoded list of exact .ts files. Project has
src/shared/lib/db/index.ts + schema/index.ts -> no match -> guessedPaths().
Interactive prompt shows the guess as initialValue with NO marker that it is
a guess (init.ts:230 gates the warning on `unattended`). drizzle.config.ts
with the exact schema path sits unread in the repo root.

## F2 no validation of the entered path
init writes a config importing a module that does not exist; the failure
surfaces later as a raw jiti "Cannot find module" from `flowpanel migrate`.

## F3 /admin route collision
init hardcodes `${appDir}/admin/[[...slug]]`. Project already serves /admin
from src/app/(dashboard)/admin/page.tsx (route group -> same URL).
`next dev` dies: "You cannot define a route with the same specificity as a
optional catch-all route". config.basePath exists but init never sets it.

## F4 auth stub written over a real provider
detectAuth knows 5 file paths, nothing about better-auth/NextAuth/Clerk.
Project has better-auth at src/entities/Auth/api/auth.ts -> stub written
anyway at src/server/lib/auth.ts, signing everyone in as admin.

## F5 init patches the ROOT layout with <ThemeScript/>
Injected into src/app/layout.tsx — the layout of the whole marketing site,
not of the admin. Project already ships its own pre-paint theme script and a
nonce-based CSP; ThemeScript renders an inline script with no nonce -> CSP
blocks it in production. init should scaffold a layout under the admin route
segment instead of touching the app-wide one.

## F6 admin.css re-imports tailwindcss
Host globals.css already does `@import "tailwindcss"`. The suggested
`import "@/styles/admin.css"` in the layout yields a second full Tailwind
build (preflight twice) over the marketing site. No guidance for the
"host already has Tailwind v4" case.

## F7 `flowpanel migrate` does not load .env
The config imports the app's db client, which reads process.env. next dev
loads .env; the CLI does not -> postgres() falls back to defaults and the
command dies. Nothing in the output mentions env.

## F8 db failure cause is swallowed
"Failed query: CREATE TABLE IF NOT EXISTS _flowpanel_migrations" with no
cause chain, and FLOWPANEL_DEBUG=1 only adds a drizzle stack — the actual
ECONNREFUSED never appears.

## F9 postgres NOTICE objects leak into CLI output
Raw notice objects printed between the CLI's own lines.

## F10 host middleware swallows the admin route
Project middleware has an APP_ROUTES allowlist; unknown paths 307 to "/".
/flowpanel (and /admin too, had it not collided) never reaches the page.
init writes no note about an existing middleware.ts/proxy.ts.

## F11 auth.role is synchronous, but role usually lives in the DB
better-auth (and NextAuth by default) do not carry `role` in the session, so
`role: (s) => s.user.role` silently returns "guest" -> "Access denied" with
no hint about what role was actually resolved. The only way out is to do the
lookup inside `session` and return an enriched object — undocumented, and
the generated template hands you the broken shape with an `as` cast.

## F12 list query is SELECT * despite `columns`
resource-list.tsx never sets ctx.select; the adapter's projection() is dead
code from this path (packages/next/src/pages/resource-list.tsx:106-122).
29 columns pulled to render 4. It also means unrelated schema drift kills the
page: one missing column (`closure_reason`) 500'd the whole Orders list.

## F13 resource query errors escape to the host's error boundary
The 500 surfaced as the project's global-error page ("Что-то пошло не так").
No FlowPanel-side error surface naming the resource/query, even in dev.

## F14 rows look openable but are not; the detail route is unreachable
DataTable announces "Rows. Arrow keys or j and k move, Enter opens." always,
but activation needs rowClick:"drawer" + drawer config. Clicking a row does
nothing. /flowpanel/order/<id> renders a working detail page that nothing in
the UI links to.

## F15 singular/plural copy: "Edit Orders" / "New Orders" for one row

## F18 required-field message is raw Zod
"Invalid input: expected string, received undefined" instead of "Required".

## F19 create is impossible when a required column is outside `columns`
POST returns 422 with fieldErrors for externalId/url/contentHash — fields the
form never renders, so the client drops them and shows a bare
"Validation failed" with no field markers. Dead end with no way forward from
the UI, and no config-time warning that the resource cannot be created.

## F17 doctor hardcodes app/admin/[[...slug]]
Probe ignores config.paths.admin -> false "✗ Catch-all admin page" for any
admin mounted elsewhere, and `doctor --fix` would recreate the very file that
made `next dev` refuse to boot (F3).

## F20 init prerequisite forces Next ^16.3 — host bumped 16.2.12→16.3.4 and lost `experimental.viewTransition` (typecheck red)
## F21 table({query}) — columns are keys only: English humanised headers, no labels, no rowKey → React key warnings
## F22 detail.header is ignored; PageHeader always renders "Label · pk"
## F23 createRedisPublisher opens ioredis without .on("error") → transient Redis error = uncaughtException; also opens pub+sub for publish-only processes
## F24 related-resource detail tabs: `reference` labels not resolved (raw uuids), parent FK column can't be hidden
## F25 dashboard header actions overflow at 390px
## F26 labels.allOption / searchPlaceholder not applied to filter chrome ("All", "Any", "Search …"); "Edit", "Save view…", "N results", date presets, "No data", "No related rows", "DASHBOARDS/RESOURCES" not in LabelsConfig
## F27 date cells: fixed "YYYY-MM-DD HH:mm" UTC, no locale/timezone option; numbers use en-US grouping ("1,774")
## F28 execSql necessity: drizzle 0.45 × postgres-js — raw Date params crash db.execute; adapter-drizzle should document/handle for hosts using db.execute in widgets
## F29 drawer/tab `fields` accept FieldDef but serializeFields() drops `label`; labels come only from resource `columns` (hidden columns are the workaround) — docs silent about it
## F30 ThemeScript renders an inline <script> with no `nonce` prop — blocked by nonce-based CSP in production; hosts must inline buildThemeInitScript themselves
## F31 CONFIRMED: detail.tabs[].fields and hidden columns are folded into declaredRowFields → list page and related tabs project them (25 rows × full prompts on /new-admin/ai_run); the JSON list API alone is columns-only
## F32 dashboards have no refresh interval / freshness indicator; realtime is event-only, so a quiet channel looks frozen
## F33 rowClick accepts only "drawer" | false — no way to make a row open the detail page
## F34 init writes `@source "../../node_modules/@flowpanel/*/dist"` (+ .pnpm variant) — Tailwind 4.3 does not expand `*` over directories, so under pnpm none of FlowPanel's utilities are generated (sm:col-span-*, md:hidden…); measured with a postcss probe: 0 rules vs 439 with explicit per-package paths. Every pnpm host gets a broken grid. Template should list react/next/charts dist explicitly or ship a prebuilt utilities CSS.

## F35 bindPublisher binds once per process (globalThis symbol) and never re-binds on HMR — a dev server started before the realtime driver was configured keeps `driver: "memory"` for its whole life; SSE looks broken with no diagnostic. Restarting `next dev` was the only fix.
## F36 no way to publish from outside the Next process without pulling in FlowPanel's own ioredis client (see F23); hosts with a guarded Redis client must reimplement the wire format (`{channel,payload}` envelope) by hand.
## F37 detail tabs are ALL rendered eagerly on the server (resource-detail.tsx renderTabs loops every tab before returning); a 12-tab user card runs every tab's queries on every page load, and the client-side Tabs then hides 11 of them. No lazy/streamed tab.
## F38 DetailTab.key is documented as "the tab's URL fragment" (resource.ts:147) but DetailTabsClient reads and writes `?tab=` — links written against the doc (`href="#feed"`) silently do nothing.
## F39 related-resource detail tabs are capped at RELATED_TAB_PAGE_SIZE=25 with no pagination, no sort, no filter and no "see all" link — a user with 1384 scores shows 25 with no hint there are more. Same for `table()` widgets.
## F40 resource-list.tsx:196 hardcodes `placeholder={`Search ${displayPlural}…`}` and ignores labels.searchPlaceholder, which is otherwise wired end-to-end — a fully Russian admin still says "Search Пользователи…".
## F41 charts have no empty state: a query returning [] renders a blank card body (axes only, or nothing for pie). Combined with client-only recharts and no skeleton, dashboards show empty framed boxes for ~1-2 s on every load and permanently for data-less panels.
## F42 pieChart defaults showLegend:false — a donut with no labels and no legend carries zero information; the default should be legend-on.
## F43 no host-side hook to render a per-row detail title. F22's `detail.header` is dead, PageHeader is a component slot but only receives the already-built title string, so a detail page can only ever say "Label · <uuid>".

