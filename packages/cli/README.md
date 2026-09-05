# @flowpanel/cli

The `flowpanel` CLI — scaffold, develop, ship.

[![npm](https://img.shields.io/npm/v/%40flowpanel%2Fcli.svg)](https://www.npmjs.com/package/@flowpanel/cli)

> Bootstrap with `pnpm dlx @flowpanel/cli init` — it installs `@flowpanel/kit` plus this CLI as a devDependency, so every later command runs as `pnpm flowpanel <command>`.

## Commands

```
flowpanel init                 Detect stack and scaffold config + wiring
                               --yes --dry-run --json
                               --path /ops/admin
                               --db <module> --schema <module> --auth <module>
                               --dev-auth     Opt into an open development-only identity
flowpanel dev                  Start `next dev` (and bull-board if REDIS_URL set)
flowpanel new <resource>       Add a resource(...) entry to flowpanel.config.ts
                               --table <expr>   Override the schema table reference
                               --kind prisma    Generate string-literal first arg
                               --dry-run --json
flowpanel migrate              Apply SQL migrations from flowpanel/migrations/
                               --dry-run --json
flowpanel doctor [--fix]       Health check; --fix writes missing route files
                               --dry-run --json
                               --path /ops/admin  Resolve a dynamic configured mount
flowpanel eject <target>       Take ownership of a piece of FlowPanel
                               resource <name>
                               dashboard <path>
                               layout
                               --force          Overwrite existing files
                               --dry-run --json
```

## What `init` writes

```
flowpanel.config.ts
app/admin/[[...slug]]/page.tsx
app/admin/layout.tsx
app/api/flowpanel/[...route]/route.ts
app/api/flowpanel/stream/route.ts
styles/admin.css
flowpanel/migrations/0001_init.sql
```

Routes use `src/app` when appropriate. `--path` chooses the admin URL; if `/admin`
is occupied (including through a route group), init proposes `/flowpanel` and
writes the same mount into `paths.admin`. If that is occupied too, it stops before
writing. The admin stylesheet is imported by the admin's own layout; the host root
layout is never patched. A standalone root layout is created under the admin
segment when the host has no shared root layout.

Local DB/schema/auth imports are checked before any files are written. Directory
`index.ts` modules and custom tsconfig path aliases are supported; missing modules
or named exports produce a diagnostic with the corresponding override flag.
Dynamic imports and inherited aliases that cannot be resolved statically require
an explicit local path.

When no `getSession` helper is found, init writes a closed authentication adapter.
Connect it to your provider and map `auth.role` before opening the admin. Role
lookup may be asynchronous. `--dev-auth` explicitly opts into the development-only
stub that treats every request as admin and refuses production use.

The generated stylesheet imports FlowPanel's precompiled, isolated CSS. Tailwind
is not required for the default setup. The legacy `@flowpanel/react/styles/admin.css`
source export remains available for projects that deliberately compile it with their
own Tailwind pipeline.

Before writing, `init` and `doctor` resolve the project's installed package
manifests instead of trusting dependency ranges. FlowPanel supports Node 20+, Next
16.3–16.x, React and React DOM 19, Drizzle 0.45.2–0.x, or Prisma 5–6. TypeScript
must be installed. A declared but unresolved FlowPanel kit or CLI is installed with
its existing project specifier and then resolved again; application runtimes are
never upgraded by `init`.

`doctor` follows static config re-exports and reads `paths.admin`. It refuses to
repair a route that overlaps existing pages. For a dynamic path, pass its resolved
URL with `doctor --path /ops/admin`; static checks do not execute your DB/auth config.

Mutating commands compute a complete plan first. Existing files with different
content are conflicts unless `eject --force` explicitly targets one; writes are
atomic and rolled back if a later file fails.

## What `eject` does

Each ejected file is stamped with `// flowpanel: ejected @ <semver> — this file is yours`. The matching config entry is commented out in `flowpanel.config.ts` via ts-morph (resource + dashboard targets); layout is auto-applied by Next.js's segment system.

## Documentation

<https://flowpanel.tech>

## License

MIT
