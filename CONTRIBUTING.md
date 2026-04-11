# Contributing to FlowPanel

## Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL 14+ (for integration tests)

## Setup

```bash
git clone https://github.com/Ch4m4/flowpanel.git
cd flowpanel
pnpm install
pnpm build
```

## Development

```bash
# Build all packages
pnpm build

# Run unit tests
pnpm test:unit

# Run integration tests (requires PostgreSQL)
DATABASE_URL=postgresql://test:test@localhost:5433/flowpanel_test pnpm test:integration

# Lint
pnpm lint
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add retention aggregation
fix(react): fix drawer close on Escape
chore(ci): add Node 22 to matrix
```

Scopes: `core`, `react`, `cli`, `adapter-drizzle`, `adapter-prisma`, `e2e`, `ci`

## Pull Requests

1. Fork and create a feature branch from `main`
2. Make your changes with tests
3. Run `pnpm test:unit && pnpm build`
4. Open a PR — squash merge into `main`

## Release Workflow

We use [changesets](https://github.com/changesets/changesets) for versioning:

```bash
pnpm changeset        # create a changeset
pnpm changeset version # bump versions
pnpm changeset publish # publish to npm
```
