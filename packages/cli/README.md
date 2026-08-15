# @flowpanel/cli

The `flowpanel` CLI — scaffold, develop, ship.

[![npm](https://img.shields.io/npm/v/%40flowpanel%2Fcli.svg)](https://www.npmjs.com/package/@flowpanel/cli)

> Bootstrap with `pnpm dlx @flowpanel/cli init` — it installs `@flowpanel/kit` plus this CLI as a devDependency, so every later command runs as `pnpm flowpanel <command>`.

## Commands

```
flowpanel init                 Detect stack, scaffold config + 5 files
flowpanel dev                  Start `next dev` (and bull-board if REDIS_URL set)
flowpanel new <resource>       Add a resource(...) entry to flowpanel.config.ts
                               --table <expr>   Override the schema table reference
                               --kind prisma    Generate string-literal first arg
flowpanel migrate              Apply SQL migrations from flowpanel/migrations/
flowpanel doctor [--fix]       Health check; --fix auto-writes missing route files
flowpanel eject <target>       Take ownership of a piece of FlowPanel
                               resource <name>
                               dashboard <path>
                               layout
                               --force          Overwrite existing files
```

## What `init` writes

```
flowpanel.config.ts
app/admin/[[...slug]]/page.tsx
app/api/flowpanel/[...route]/route.ts
app/api/flowpanel/stream/route.ts
styles/admin.css
flowpanel/migrations/0001_init.sql
```

Plus, conditionally: `tailwind.config.ts` (Tailwind v3 projects only) and `app/layout.tsx` (only when your project has none yet).

## What `eject` does

Each ejected file is stamped with `// flowpanel: ejected @ <semver> — this file is yours`. The matching config entry is commented out in `flowpanel.config.ts` via ts-morph (resource + dashboard targets); layout is auto-applied by Next.js's segment system.

## Documentation

<https://flowpanel.tech>

## License

MIT
