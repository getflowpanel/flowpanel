# Contributing to FlowPanel

## Setup

Node 22 (see `.nvmrc`) and pnpm 10.

```bash
git clone https://github.com/getflowpanel/flowpanel
cd flowpanel
pnpm install
pnpm -r typecheck
pnpm -r test:unit
```

The workspace holds `packages/*`, `examples/*` and `apps/*`. Run one package's tests with `pnpm --filter @flowpanel/core test:unit`.

## Pull requests

1. Open an issue first for anything beyond a small fix.
2. Branch off `main` as `feat/…`, `fix/…` or `docs/…`.
3. Add tests for behavior changes.
4. Add a changeset with `pnpm changeset`: the bump level and one sentence a user would care about.
5. If you change a public export or builder signature, add a type test in `packages/<pkg>/types-test/`, update `apps/site/content/docs/reference/`, run `pnpm docs:llms`, and list the added, changed or removed symbols in the PR.

By contributing you license your work under the project's [MIT license](../LICENSE).

## Code

- TypeScript `strict` with `exactOptionalPropertyTypes`.
- No `any` in public types.
- Client modules start with `"use client"`; server-only modules are imported only from the server.

## Tests

- Unit tests with Vitest.
- Adapter integration tests with Testcontainers; they skip without Docker.
- End-to-end and accessibility tests with Playwright against `examples/ai-scraper` (`packages/e2e`).
- Type tests with `tsd`: `pnpm -r test:types`.

CI runs all of them, plus lint and size limits, on every PR.

## Docs

The site at <https://flowpanel.tech> renders `apps/site/content/docs/`. `pnpm check:docs` type-checks the examples and fails while `llms.txt` is stale.

## Questions

Ask in GitHub Discussions, or open an issue labelled `question`.
