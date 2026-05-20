# CLI

The `flowpanel` CLI ships in the umbrella package. Six commands today,
registered in `packages/cli/src/index.ts`:

| Command | Purpose |
|---|---|
| [`flowpanel init`](#flowpanel-init) | Scaffold config + wiring files into an existing Next.js project. |
| [`flowpanel migrate`](#flowpanel-migrate) | Apply SQL migrations (audit + tracking tables). |
| [`flowpanel doctor`](#flowpanel-doctor) | Health-check wiring; `--fix` auto-scaffolds missing files. |
| [`flowpanel eject`](#flowpanel-eject) | Convert a resource / dashboard / layout to user-owned source. |
| [`flowpanel dev`](#flowpanel-dev) | Run `next dev` (and bull-board if `REDIS_URL` is set). |
| [`flowpanel new`](#flowpanel-new) | Add a `resource(...)` entry to `flowpanel.config.ts`. |

Run any command with `--help` for inline flag docs.

## `flowpanel init`

```bash
pnpm flowpanel init
pnpm flowpanel init --yes        # accept all detected defaults (CI mode)
```

Detects your stack and scaffolds six files. The ORM choice picks the
matching config template — Drizzle if `drizzle-orm` is installed,
Prisma if `@prisma/client` is installed
(`packages/cli/src/commands/init.ts:43`). If both are installed, Drizzle
wins.

| Path | Purpose |
|---|---|
| `flowpanel.config.ts` | Typed admin config (`defineAdmin({...})`). Adapter wired to the detected ORM. |
| `app/admin/[[...slug]]/page.tsx` | Mounts the admin at `/admin`. |
| `app/api/flowpanel/[...route]/route.ts` | Drawer GET + drawer-action POST handlers. |
| `app/api/flowpanel/stream/route.ts` | SSE endpoint for realtime channels. |
| `styles/admin.css` | The `--fp-*` token sheet — import from your root layout. |
| `flowpanel/migrations/0001_init.sql` | Audit log + migration tracking tables. |

(`packages/cli/src/commands/init.ts:117`.)

The interactive flow prompts for: app name, DB client import path,
schema import path, auth helper path. `--yes` skips the prompts.

Existing files trigger an overwrite prompt; choose `n` to skip.

## `flowpanel migrate`

```bash
pnpm flowpanel migrate
pnpm flowpanel migrate --dry-run
```

Applies every `.sql` file in `flowpanel/migrations/` against the
database your adapter is configured for. Adapter-agnostic — works
through `config.adapter.db.execute(sql)`. Idempotent: a migrations
tracking table records applied filenames and re-running skips them.

`--dry-run` prints the filenames that would be applied without
executing them.

If `flowpanel.config.ts` cannot be loaded (no `jiti` installed, syntax
error, missing file), the command exits 1 with a hint.

Source: `packages/cli/src/commands/migrate.ts`.

## `flowpanel doctor`

```bash
pnpm flowpanel doctor
pnpm flowpanel doctor --fix
```

Audits your project setup:

- Next.js `>= 15` installed
- TypeScript installed
- An ORM adapter (Drizzle today; Prisma is detected by `init` but the
  doctor check is Drizzle-only at this version)
- `flowpanel.config.ts` present
- `app/api/flowpanel/[...route]/route.ts` present
- `app/api/flowpanel/stream/route.ts` present
- `flowpanel/migrations/0001_init.sql` present
- `app/admin/[[...slug]]/page.tsx` present
- For each ejected resource: the file is stamped with the eject marker

(`packages/cli/src/commands/doctor.ts:43`.)

`--fix` scaffolds the four missing wiring files from the same templates
`init` uses. `flowpanel.config.ts` is **not** auto-fixed — it needs
user input — but the missing-marker check is also not auto-fixed.

## `flowpanel eject`

```bash
pnpm flowpanel eject resource users
pnpm flowpanel eject dashboard "/monitoring"
pnpm flowpanel eject layout
pnpm flowpanel eject resource users --force         # overwrite existing files
```

Three targets, no fourth (Invariant I-6, ADR 0003):

| Target | What lands | Effect on `flowpanel.config.ts` |
|---|---|---|
| `resource <name>` | `app/admin/<name>/{page,new,[id]/{page,edit/page},actions}.tsx` (5 files). | `resource(...)` entry is commented out. |
| `dashboard <path>` | `app/admin/<path>/page.tsx` (or `app/admin/page.tsx` for `/`). | `dashboard({...})` entry is commented out. |
| `layout` | `app/admin/layout.tsx`. | No change — Next.js auto-wraps the admin tree. |

Every ejected file is stamped:

```
// flowpanel: ejected @ <version> — this file is yours
```

Source: `packages/cli/src/eject/marker.ts`, `packages/cli/src/commands/eject.ts`.
The marker is what `flowpanel doctor` checks — removing it warns; the
runtime still skips the ejected resource regardless.

## `flowpanel dev`

```bash
pnpm flowpanel dev
pnpm flowpanel dev --port 3010
pnpm flowpanel dev --no-board         # don't start bull-board even if REDIS_URL is set
```

Runs `next dev` (with prefixed `[next]` log lines). If `REDIS_URL` is
set **and** `scripts/board-server.ts` exists, also spawns the
bull-board server with `[board]` prefixed logs. Forwards `SIGINT` /
`SIGTERM` to both processes.

Source: `packages/cli/src/commands/dev.ts`.

## `flowpanel new`

```bash
pnpm flowpanel new posts
pnpm flowpanel new posts --table schema.posts                    # explicit table expr
pnpm flowpanel new posts --kind prisma                           # Prisma config
```

Inserts a `resource(...)` entry into the `resources: [...]` array of
`flowpanel.config.ts`. Defaults: `table = schema.<name>`, `kind =
drizzle`. The Prisma kind generates `resource(prisma.<name>, { ... })`.

Source: `packages/cli/src/commands/new.ts`, with the insertion logic in
`packages/cli/src/eject/addResource.ts`.

## See also

- [Getting started](../guides/getting-started.md) — full bootstrap walkthrough
- [Adapters](./adapters.md) — Drizzle / Prisma config shapes
- [ADR 0003](../adr/0003-eject-three-targets.md) — why three eject targets
