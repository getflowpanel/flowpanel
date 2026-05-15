# ADR 0005 — Two ORM adapters at 1.0 (Drizzle + Prisma)

**Status:** Accepted (M4a → frozen for 1.0)

## Context

Spec §9 calls for adapter-based ORM integration: FlowPanel does not own
the database client, it consumes one through an `Adapter` interface. The
question is how many adapters to ship at 1.0:

- **One** (Drizzle only): simplest. Validates the abstraction against a
  single backend. Risks hidden coupling — the abstraction may turn out to
  be drizzle-shaped, not adapter-shaped.
- **Two** (Drizzle + Prisma): proves the abstraction. Twice the testing
  burden. Two ORMs cover the vast majority of TypeScript backend usage
  in 2026.
- **N** (Drizzle + Prisma + Kysely + raw SQL + …): every additional
  adapter compounds the maintenance surface. Each new ORM has its own
  query DSL, dialect quirks, generated client mechanics.

## Decision

Ship **two** adapters at 1.0:

1. **`@flowpanel/adapter-drizzle`** — first-party. Postgres, MySQL,
   SQLite. Tests cover all three dialects (PG via testcontainers, MySQL
   via testcontainers, SQLite via better-sqlite3 in-memory).
2. **`@flowpanel/adapter-prisma`** — first-party. Runtime DMMF
   introspection (no codegen step). Soft-delete + restore. Tests cover
   SQLite via the generated client.

Mixing adapters in one config is **out of scope for 1.0** (spec §9.3).
One project, one ORM. Multi-adapter configs would require resolving
which adapter handles a given resource, what happens when a query spans
adapters, etc. — questions that don't have clean answers and aren't
needed for any user use case we've heard.

## Why these two specifically

- **Drizzle** has the largest mindshare in the TypeScript-native ORM
  space and the cleanest type inference story (FlowPanel's
  `InferSelect<typeof schema.users>`-driven typing relies on it).
- **Prisma** has the largest absolute install base in Node TypeScript and
  comes with battle-tested migrations, a mature studio, and a runtime
  DMMF that we can introspect without code generation.

**Kysely**, **TypeORM**, **MikroORM**, etc. are deferred to 1.x as
community-maintained adapters or first-party additions. The `Adapter`
interface is stable; adding a new one is mechanical.

## Consequences

**Wins:**

- The `Adapter` interface gets battle-tested against two genuinely
  different ORMs (drizzle's tagged-table-objects vs prisma's
  delegate-by-name dispatch). Issues found during Prisma adapter
  development (non-RETURNING dialect handling, ID coercion for Int PKs)
  generalized into improvements in the Drizzle adapter too.
- `Adapter.kind: "drizzle" | "prisma"` is a simple discriminant — code
  that needs to specialize can `switch` on it.

**Costs / constraints:**

- Two adapters mean two integration-test surfaces. CI runs both against
  real database containers. SQLite path runs without Docker for fast
  smoke. Postgres + MySQL paths skip gracefully when Docker is absent
  (`describe.skipIf(!dockerAvailable)`).
- The `Adapter.kind` union must add a literal for each new adapter.
  This is a major-version bump (every consumer of the type must
  recompile) — that's intentional, since adding an ORM is a real
  expansion of the supported surface.
- Kysely, TypeORM, MikroORM users wait. Each is a deferred 1.x feature.

## References

- `packages/core/src/types/adapter.ts` — the `Adapter<DB>` interface +
  `kind` discriminant.
- `packages/adapter-drizzle/src/adapter.ts` — Drizzle implementation,
  three-dialect support.
- `packages/adapter-prisma/src/adapter.ts` — Prisma implementation, DMMF
  introspection.
- `docs/spec/flowpanel-v1.0.md` §9.3 — "pick one" rule.
