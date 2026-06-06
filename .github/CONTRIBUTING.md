# Contributing to FlowPanel

Thanks for your interest. FlowPanel is a solo-maintained project that takes
its public API seriously — the bar for incoming changes is high but the
path is clear.

## Local setup

```bash
git clone https://github.com/getflowpanel/flowpanel
cd flowpanel
pnpm install
pnpm -r typecheck
pnpm -r test:unit
```

Node ≥ 22 (see `.nvmrc`), pnpm 10. The repo is a workspace monorepo (`packages/*`,
`examples/*`). Most development happens against a single package's tests
(`pnpm --filter @flowpanel/core test:unit`).

## Workflow

1. **Open an issue first** for non-trivial changes. Drive-by fixes
   (typos, comment clarifications) can skip this — open a PR directly.
2. **Branch off `main`.** Name the branch by intent: `feat/...`,
   `fix/...`, `docs/...`.
3. **Write tests.** TDD is preferred. Untested behavior changes will be
   asked for tests before merge.
4. **Add a changeset.** Run `pnpm changeset`, pick the bump level, write
   one user-visible sentence. The CI gate `changeset-required.yml`
   enforces this on PRs that touch package source.
5. **Open the PR.** Fill out the template. If you touched
   `packages/*/src/index.ts`, describe the public-surface impact in the
   PR (symbols added / changed / removed) and include a tsd type-test.
6. **License.** By contributing you agree that your contributions are
   licensed under the project's [MIT license](../LICENSE).

## Coding standards

- TypeScript `strict` + `exactOptionalPropertyTypes` everywhere in
  package source.
- Files > 300 LOC need a split justification in the PR.
- No `any` in public types. Internal `any` needs an inline comment
  explaining why.
- Public symbols carry JSDoc with `@example` where it adds clarity.
- Server-only modules carry `"use server"` or are server-imported only;
  client-only modules carry `"use client"`. Universal modules (no
  side effects on import) have neither directive.

## Tests

Five layers, in order of cost:

1. **Unit** (`vitest`) — public functions and components. Always run.
2. **Integration** (`testcontainers`) — adapter behaviors against real
   databases. Skip gracefully when Docker is absent (`describe.skipIf`).
3. **E2E** (Playwright) — `examples/freelance-radar` flows.
   `packages/e2e/` boots the example via `webServer`.
4. **Type tests** (`tsd`) — public API shapes. Run via `pnpm -r test:types`.
5. **A11y** (Axe via Playwright) — 0 wcag2aa violations.

CI runs all of unit + typecheck + lint + size-limit on every PR. The
integration / E2E / a11y layers run on `main` and tagged releases.

## Releases

`@changesets/cli` drives versioning. Maintainer publishes from `main`
after a `pnpm changeset version` bump and final gate
(`pnpm -r typecheck && pnpm -r test:unit && pnpm -r --filter '!./examples/**' --filter '!@flowpanel/e2e' build`).

For pre-release lines (alpha, beta), the maintainer uses
`pnpm changeset pre enter <tag>` before bumping.

## Public-API discipline

Every export from `packages/*/src/index.ts` is a public contract, so the
bar for changes there is high. Internal architecture notes (invariants,
ADRs) are maintained privately by the maintainer; you don't need access
to them to contribute. When you touch `packages/*/src/index.ts` or any
builder signature (`defineAdmin`, `resource`, `dashboard`, `metric`,
`table`, etc.):

1. Add a changeset (`pnpm changeset`).
2. Include a tsd type-test in `packages/<pkg>/types-test/` for any new or
   changed public symbol, and update
   `apps/site/content/docs/reference/`.
3. Describe the public-surface impact in the PR — list the symbols
   added / changed / removed.

The maintainer will flag any conflict with an internal invariant during
review and, if needed, ask for the design to be reworked.

## Repo layout

The published docs site (<https://flowpanel.tech>) renders from
`apps/site/content/docs/` — that's the canonical user-facing surface.
Internal architecture notes (invariants, ADRs, specs) are maintained
privately by the maintainer and are not part of this repository.

`packages/react/src/` uses underscore-prefixed folders (`_atoms/`,
`_data/`, `_shell/`, `_widgets/`, `_provider/`, `_feedback/`,
`_forms/`, `_layout/`) to group internal building blocks by role.
The prefix is a *convention*, not a privacy boundary — every folder's
contents are still publicly exported through `index.ts`. The pattern
exists so a contributor reading the tree knows immediately which
files implement a primitive (atoms, feedback) vs which orchestrate a
surface (shell, widgets, data tables).

## Asking questions

Open a GitHub Discussion (preferred) or an issue tagged `question`.

Thanks for contributing.
