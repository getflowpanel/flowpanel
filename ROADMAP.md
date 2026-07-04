# FlowPanel roadmap

> What lands next, in rough order of priority. Open issues drive the
> specifics; this file is the high-level shape.

## 1.0 — in progress

Packages are still versioned `0.1.0`; the pending changeset queue is
minor-only (`pnpm exec changeset status` — no major bumps queued), so a 1.0.0
release has not shipped yet. Scope landing on the way there: the DSL
(`defineAdmin` + `resource` + `dashboard` + builders), Drizzle and Prisma
adapters, the Next.js bridge (`Flowpanel(config)` + `handlers()` +
`stream()`), the React UI (DataTable, drawer, dashboard widgets, ⌘K
palette, theme.components, eject), CSV/JSON import + export, field-level
RBAC, global read-only mode, the CLI (`init`, `migrate`, `doctor`, `eject`,
`dev`, `new`), and the public docs at flowpanel.tech.

## 1.x — near-term

- **File uploads.** A first-class `type: "file"` / `"image"` column with a
  presigned-URL handler contract. Currently a documented stub.
- **Saved filter views.** Beyond URL-synced state — persist per-user named
  filter sets server-side.
- **Postgres `LISTEN/NOTIFY` realtime driver.** Alternative to the Redis
  pub/sub driver, no extra infra.
- **More examples.** `examples/with-clerk`, `examples/multi-tenant`,
  `examples/with-prisma` — beyond the existing `ai-scraper` showcase.

## 1.x — longer

- **SSO/SAML turnkey** preset alongside `withClerk` / `withNextAuth` /
  `withLucia`.
- **Visual config GUI.** Browse `flowpanel.config.ts` shape and edit
  resources/columns/dashboards without leaving `/admin`.
- **Mobile-first redesign** of the shell. The desktop UI already collapses
  to a Sheet drawer on `< md`, but the form/drawer surface deserves a
  dedicated mobile pass.

## Not planned

- **Pages Router support.** App Router only.
- **Non-Next.js standalone runtime.** The bridge depends on RSC + Server
  Actions.
- **Mixed adapters in one config.** One adapter per `defineAdmin` call.
