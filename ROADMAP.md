# FlowPanel roadmap to "safe to try"

> This is the honest path from pre-1.0 today to a tool you can recommend
> to another developer for their side-project — not a marketing plan.
> Written from senior-review notes, not optimism.

## Status today

- Core works: CRUD, filters, actions, row-level security, SSE realtime,
  widget/dashboard builder, Drizzle + Prisma adapters, shadcn-based UI
  with design tokens.
- 447 unit tests passing. Typecheck green across 9 packages.
- One end-to-end example (`examples/freelance-radar`).
- **Zero external adopters.** Zero e2e tests. No CI matrix. No
  changelog discipline. Public API still leaks internals.

## Definition of "safe to try"

A real-world developer can:

1. Run `pnpm flowpanel init` on an existing Next.js + Prisma/Drizzle
   project and land on a working `/admin` in under 10 minutes.
2. Hit any failure mode (missing session, unapplied migration, bad
   adapter shape) and get a message that points at the fix, not a
   stack trace.
3. Build the three admin patterns that 80% of SaaS hit: multi-tenant
   scope, file uploads, JSONB editors — from documented recipes,
   not by reverse-engineering source.
4. Open the repo and not see cosmetic red flags (duplicate builders,
   `V2` on a pre-1.0 type, internal helpers in the public index).

We are not ready when the tests pass. We are ready when an outsider
ships an admin on a real side-project and reports no critical bugs.

---

## Phase 0 · Hygiene (1-2 days)

**Gate:** a senior dev browsing `packages/core/src/index.ts` doesn't close the tab in the first 3 minutes.

| # | Task |
|---|---|
| 0.1 | Hide internal `resolve*` / `serialize*` / `evaluate*` / `create*Descriptor` from `packages/core/src/index.ts`. |
| 0.2 | Collapse `resource()` and `defineResource()` into one typed builder. Update docs + example. |
| 0.3 | Rename `FlowPanelV2Extensions` → merge into a single `FlowPanelConfig` interface. |
| 0.4 | Align `freelance-radar` dashboard to the functional form (`dashboard: (w) => [...]`) used throughout `docs/`. |
| 0.5 | Tokenize `StatusTag.tsx`: add `--fp-status-running / -success / -error` to `tokens.css`, route through `var()`. |
| 0.6 | Move CLI `flowpanel add` widget templates out of template literals into `.tsx.txt` files loaded via `fs.readFileSync`. |
| 0.7 | Split `ResourceActionButton.tsx` (413 LOC) into button + confirm-dialog + dialog-form. |

**Exit criteria**
- `pnpm -r typecheck` green
- `pnpm -r test` green (no behaviour change expected)
- `grep -E '(resolve|serialize|evaluate)[A-Z]' packages/core/src/index.ts` empty
- One builder exported (`defineResource`), the other gone
- No `V2` in any type name anywhere

## Phase 1 · Correctness (2-3 weeks)

**Gate:** first real adopter cannot hit "install → broken → no fix in docs".

### 1.1 E2E test (one is non-negotiable)
Scenario lives in `packages/e2e/`:
```
create-next-app → add FlowPanel → flowpanel init --yes → next dev
→ curl /admin = 200 with "FlowPanel"
→ curl /api/trpc/flowpanel.schema = 200 with resource list
→ playwright: CRUD cycle on a test resource
```
Runs in CI. Catches 80% of init/route/adapter regressions.

### 1.2 CI matrix
`.github/workflows/ci.yml` — Node 20+22 × ubuntu+macos. Required: typecheck, lint, unit tests, build, e2e. Windows deferred to 1.0.

### 1.3 Error envelope audit
Every throw point in core + adapters answers three questions: what, why, fix. Preflight check that surfaces "run `flowpanel migrate`" instead of a cryptic SQL error on first boot with no audit table.

### 1.4 Three real-world recipes
Each is `docs/recipes/*.md` + a working cutout in the flagship example:

1. **Multi-tenant scope** via `rowLevel`, applied to list/get/update/delete/actions/widgets. Test: tenant-A user cannot read tenant-B records through any endpoint.
2. **File uploads** — a new column type `file` with drag-and-drop preview and a presigned-URL handler contract.
3. **JSONB editor** — readable render in tables, editable in forms.

### 1.5 Security sanity pass
- Tests that attempt to bypass `access`: direct tRPC calls, filter tampering, stepUp races.
- Filter builder injection audit (drizzle + prisma adapters).
- `SECURITY.md` with CVE reporting channel.

### 1.6 Changeset discipline
Every `feat:` / `fix:` commit has a `.changeset/` entry. CI fails PRs without one (unless labelled `no-release`).

**Exit criteria**
- CI green on all matrix slots
- `packages/e2e` runs locally via `pnpm e2e` and in CI
- Three recipes work on Postgres in docker-compose
- `SECURITY.md` live

## Phase 2 · Adoption surface (3-5 days)

**Gate:** a visitor landing on the repo doesn't ask "is this project alive?"

- Deploy `freelance-radar` to Vercel as a read-only live demo.
- Rewrite README: hero (15s), demo GIF, comparison table (vs Refine / AdminJS / Forest), install, links.
- `CONTRIBUTING.md` with: dev setup, architecture map, how to add a cell renderer / column type / widget kind / adapter.
- `.github/ISSUE_TEMPLATE/bug.md` + `feature.md`.
- Public `ROADMAP.md` kept current (this file).

## Phase 3 · Silent beta (4-6 weeks)

Hand-pick 5 developers building real side-projects that need an admin panel. Not HN. Not Reddit. People you can debug with over a call.

Metrics that gate Phase 4:
- Zero critical issues open > 7 days
- ≥ 15 bugfix commits driven by their feedback (not hypothetical)
- ≥ 3 of 5 reach "deployed to production" (even if production = their side-project)
- Zero unpatched security reports

Exit criterion is honest: would *you* install this on *your* new
project knowing every limitation? If yes, proceed.

## Phase 4 · Public beta (1-week launch + ongoing)

Pre-condition: all previous gates passed.

- Show HN, r/nextjs, Twitter, Dev.to article.
- Discussions / Discord moderated daily for the first week.
- GitHub Stars are signal, not a goal.

**Not** doing: Product Hunt, sponsored posts, "launch everywhere" — those bring users with 1.0 expectations to a beta.

---

## Timeline (honest)

| Phase | Elapsed time | Blocked by |
|---|---|---|
| 0 | 2 days | me |
| 1 | 2-3 weeks | me |
| 2 | 3-5 days | me |
| 3 | 4-6 weeks | 5 external humans |
| 4 | 1 week + ongoing | momentum |

**Total to "safe to recommend": ~3 months**, of which six weeks is external feedback — not a coding task.

### Shorter "brave beta" variant (6-8 weeks)
Phase 0 + Phase 1 without file uploads / JSONB, Phase 2 without live demo (video link instead), Phase 3 compressed to 2 adopters, Phase 4 framed as "early beta, expect rough edges."

This path is real, but it burns margin: visitors read "beta" as "ready to try," so we either buffer with more adopters or risk the first bad review.
