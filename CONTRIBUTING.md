# Contributing to FlowPanel

## Setup

```bash
git clone https://github.com/Ch4m4/flowpanel.git
cd flowpanel
pnpm install
pnpm build
```

## Development

```bash
pnpm dev          # Watch mode (all packages)
pnpm test:unit    # Unit tests (Vitest)
pnpm test:e2e     # Playwright tests
pnpm lint         # ESLint
```

## Monorepo Structure

| Package | Path | Description |
|---------|------|-------------|
| @flowpanel/core | packages/core | Config schema, tRPC router, query builder |
| @flowpanel/react | packages/react | Dashboard UI components |
| @flowpanel/cli | packages/cli | CLI tools (init, migrate, doctor, dev) |
| @flowpanel/adapter-drizzle | packages/adapter-drizzle | Drizzle ORM adapter |
| @flowpanel/adapter-prisma | packages/adapter-prisma | Prisma adapter |
| @flowpanel/locale-ru | packages/locale-ru | Russian locale |
| @flowpanel/eslint-config | packages/eslint-config | Shared ESLint config |
| @flowpanel/e2e | packages/e2e | Playwright end-to-end tests |

## Commit Convention

```
type(scope): message
```

Types: `feat`, `fix`, `docs`, `design`, `test`, `chore`
Scopes: `core`, `react`, `cli`, `e2e`

## Pull Requests

- Branch from `main`
- Ensure `pnpm build && pnpm test:unit` pass
- One feature per PR
