# FlowPanel roadmap

> What lands next, in rough order of priority. Open issues drive the
> specifics; this file is the high-level shape.

## 1.0 — shipped

The DSL (`defineAdmin` + `resource` + `dashboard` + builders), Drizzle and
Prisma adapters, the Next.js bridge (`Flowpanel(config)` + `handlers()` +
`stream()`), the React UI (DataTable, drawer, dashboard widgets, ⌘K
palette, theme.components, eject), the CLI (`init`, `migrate`, `doctor`,
`eject`, `dev`, `new`), and the public docs at flowpanel.dev.

See [`CHANGELOG.md`](./CHANGELOG.md) for the launch notes.

## 1.x — near-term

- **File uploads.** A first-class `type: "file"` / `"image"` column with a
  presigned-URL handler contract. Currently a documented stub.
- **CSV import.** Mirror of the built-in CSV/JSON export.
- **Saved filter views.** Beyond URL-synced state — persist per-user named
  filter sets server-side.
- **Postgres `LISTEN/NOTIFY` realtime driver.** Alternative to the Redis
  pub/sub driver, no extra infra.
- **More examples.** `examples/with-clerk`, `examples/multi-tenant`,
  `examples/with-prisma` — beyond the existing `freelance-radar` showcase.

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
