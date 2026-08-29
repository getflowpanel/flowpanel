# Interactive Demo Sandboxes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every public ScrapeAI visitor a private, populated, fully interactive PostgreSQL sandbox with transactional reset, expiry, and abuse limits.

**Architecture:** Next.js Proxy binds an opaque browser cookie to a request header. ScrapeAI resolves that id into FlowPanel's existing global/resource scope, lazily seeds one tenant slice, and scopes generated and custom SQL to it. PostgreSQL composite foreign keys, advisory locks, TTL cleanup, and capacity checks provide the security and lifecycle boundary without changing FlowPanel core.

**Tech Stack:** Next.js 16.3 App Router and Proxy, TypeScript, FlowPanel, Drizzle ORM 0.45, PostgreSQL 16, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-30-interactive-demo-sandboxes-design.md`

## Global Constraints

- Keep every sandbox-specific implementation under `examples/ai-scraper`; do not add a demo condition or public API to shared FlowPanel packages.
- Local development and E2E always use sandbox id `local`.
- Public mode is `DEMO_MODE=true`; public mode requires `DEMO_SANDBOX_SECRET` of at least 32 characters.
- `DEMO_READ_ONLY=true` is the server-enforced emergency mutation kill switch.
- Sandbox inactivity TTL is 60 minutes, absolute TTL is 24 hours, activity writes are coalesced to once per five minutes, and cleanup is coalesced to once per 15 minutes.
- Default capacity is 200 active sandboxes and 10 creations per HMAC fingerprint per hour.
- Public bulk import is disabled; local import continues through the scoped create/default pipeline.
- Never trust a client-supplied sandbox header or sandbox id in a reset body.
- Preserve all unrelated dirty-worktree changes and stage only files named by the active task.
- Read `examples/ai-scraper/AGENTS.md` and the bundled Next.js 16 Proxy documentation before editing `proxy.ts`.
- Every behavior change follows red-green-refactor and every task ends with its focused tests green.

## File map

- `examples/ai-scraper/src/db/schema.ts`: sandbox metadata, tenant columns, composite constraints, and cascade behavior.
- `examples/ai-scraper/src/demo/sandbox/config.ts`: validated environment and fixed lifecycle limits.
- `examples/ai-scraper/src/demo/sandbox/identity.ts`: UUID/cookie/header validation and IP fingerprinting.
- `examples/ai-scraper/proxy.ts`: Next.js request binding and browser cookie issuance.
- `examples/ai-scraper/src/demo/sandbox/seed.ts`: scoped transactional persistence and generator-id remapping.
- `examples/ai-scraper/src/demo/sandbox/lifecycle.ts`: initialize, touch, capacity, reset cooldown, and expiry decisions.
- `examples/ai-scraper/src/demo/sandbox/maintenance.ts`: database-coordinated cleanup.
- `examples/ai-scraper/src/demo/sandbox/scope.ts`: one fail-closed sandbox-id extractor plus Drizzle predicates/default fields.
- `examples/ai-scraper/src/demo/sandbox/service.ts`: small application service composed from lifecycle, seed, and maintenance.
- `examples/ai-scraper/src/demo/auth/session.ts`: synthetic role plus sandbox session binding.
- `examples/ai-scraper/src/admin/config/**`: FlowPanel global/resource scope and sandboxed custom SQL.
- `examples/ai-scraper/app/api/demo/reset/route.ts`: same-origin reset for the bound sandbox.
- `examples/ai-scraper/src/demo/ui/DemoSandboxNotice.tsx`: interactive notice and reset states.
- `examples/ai-scraper/scripts/{seed,reset-demo,cleanup-demo}.ts`: explicit local/maintenance entry points.
- `packages/e2e/tests/demo-sandbox.spec.ts`: two-browser isolation, real CRUD, reset, and direct-request security.
- `packages/e2e/playwright.demo-readonly.config.ts`: isolated emergency read-only server and test gate.

---

### Task 1: Sandbox-aware relational schema

**Files:**
- Modify: `examples/ai-scraper/src/db/schema.ts`
- Modify: `examples/ai-scraper/src/db/__tests__/schema.test.ts`

**Interfaces:**
- Produces: `demoSandboxes`, `demoMaintenance`, and required `sandboxId`/nullable `seedKey` columns on every domain table.
- Produces: composite `(sandboxId, id)` parent keys and composite child foreign keys.
- Consumes: no feature code from later tasks.

- [ ] **Step 1: Write schema contract tests**

Use Drizzle's `getTableConfig` to assert the physical contract rather than checking only TypeScript properties:

```ts
import { getTableConfig } from "drizzle-orm/pg-core";

const tables = [
  schema.customers,
  schema.monitors,
  schema.runs,
  schema.products,
  schema.listings,
  schema.matches,
  schema.invoices,
  schema.aiUsage,
];

it("assigns every demo row to one sandbox", () => {
  for (const table of tables) {
    const columns = getTableConfig(table).columns.map((column) => column.name);
    expect(columns).toContain("sandbox_id");
    expect(columns).toContain("seed_key");
  }
});

it("protects ownership with composite foreign keys", () => {
  const config = getTableConfig(schema.products);
  expect(config.foreignKeys.some((fk) => fk.reference().columns.length === 2)).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `pnpm --filter ai-scraper test:unit -- src/db/__tests__/schema.test.ts`

Expected: FAIL because `demoSandboxes`, `sandbox_id`, and composite foreign keys do not exist.

- [ ] **Step 3: Add metadata tables and reusable tenant columns**

Add a column factory so each table receives distinct Drizzle column instances:

```ts
const sandboxColumns = () => ({
  sandboxId: text("sandbox_id")
    .notNull()
    .references(() => demoSandboxes.id, { onDelete: "cascade" }),
  seedKey: integer("seed_key"),
});
```

Define `demo_sandboxes` with the exact timestamps and fingerprint from the spec and
`demo_maintenance` with singleton integer id plus `last_cleanup_at`.

- [ ] **Step 4: Replace single-column ownership constraints**

For each child use a composite foreign key and sandbox-leading indexes:

```ts
foreignKey({
  columns: [table.sandboxId, table.customerId],
  foreignColumns: [customers.sandboxId, customers.id],
}).onDelete("cascade");

uniqueIndex("customers_sandbox_id_id_idx").on(table.sandboxId, table.id);
uniqueIndex("customers_sandbox_seed_key_idx").on(table.sandboxId, table.seedKey);
```

Keep customer soft deletion. Set cascade only on the disposable hard-delete relations described
by the spec. Update Drizzle `relations(...)` definitions to include both sandbox and row foreign
columns.

- [ ] **Step 5: Run schema tests, typecheck, and push into the disposable local database**

The existing local rows use the obsolete unscoped shape. Recreate only the disposable
`ai-scraper` Docker volume before applying the schema, then run:

```bash
pnpm --filter ai-scraper docker:down -- -v
pnpm --filter ai-scraper docker:up
pnpm --filter ai-scraper test:unit -- src/db/__tests__/schema.test.ts
pnpm --filter ai-scraper typecheck
pnpm --filter ai-scraper db:push
```

Expected: tests and typecheck PASS; Drizzle applies the disposable demo schema without manual SQL.

- [ ] **Step 6: Commit the schema boundary**

```bash
git add examples/ai-scraper/src/db/schema.ts examples/ai-scraper/src/db/__tests__/schema.test.ts
git commit -m "feat(demo): add sandbox ownership schema"
```

---

### Task 2: Validated configuration and request identity

**Files:**
- Create: `examples/ai-scraper/src/demo/sandbox/config.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/identity.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/__tests__/config.test.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/__tests__/identity.test.ts`
- Create: `examples/ai-scraper/proxy.ts`

**Interfaces:**
- Produces: `readSandboxConfig(env): DemoSandboxConfig`.
- Produces: `DEMO_SANDBOX_COOKIE`, `DEMO_SANDBOX_HEADER`, `resolveSandboxId`, and `fingerprintClientIp`.
- Produces: a Proxy-injected, overwritten request header consumed by Task 5.
- Consumes: Node `crypto.randomUUID`, `createHmac`, and Next 16 `NextResponse.next({ request: { headers } })`.

- [ ] **Step 1: Write failing configuration tests**

Cover local defaults, public secret rejection, fixed defaults, numeric override validation, and the
read-only switch:

```ts
expect(readSandboxConfig({})).toMatchObject({ publicMode: false, readOnly: false });
expect(() => readSandboxConfig({ DEMO_MODE: "true", DEMO_SANDBOX_SECRET: "short" })).toThrow(
  /32 characters/,
);
expect(
  readSandboxConfig({ DEMO_MODE: "true", DEMO_SANDBOX_SECRET: "x".repeat(32) }),
).toMatchObject({ maxActive: 200, maxCreatesPerHour: 10 });
```

- [ ] **Step 2: Write failing identity tests**

Assert UUID allow-listing, the stable local id, deterministic non-reversible HMAC output, and the
shared `unknown` bucket when no trusted IP exists.

```ts
expect(resolveSandboxId({ publicMode: false, cookie: null, generate: vi.fn() })).toBe("local");
expect(resolveSandboxId({ publicMode: true, cookie: "forged", generate: () => VALID_UUID })).toBe(
  VALID_UUID,
);
expect(fingerprintClientIp(null, SECRET)).toBe(fingerprintClientIp(null, SECRET));
expect(fingerprintClientIp("203.0.113.8", SECRET)).not.toContain("203.0.113.8");
```

- [ ] **Step 3: Run the focused tests and confirm red**

Run: `pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/config.test.ts src/demo/sandbox/__tests__/identity.test.ts`

Expected: FAIL because the sandbox modules do not exist.

- [ ] **Step 4: Implement pure configuration and identity helpers**

Use a frozen result shape:

```ts
export type DemoSandboxConfig = Readonly<{
  publicMode: boolean;
  readOnly: boolean;
  secret: string | null;
  maxActive: number;
  maxCreatesPerHour: number;
  inactivityMs: number;
  absoluteMs: number;
  touchIntervalMs: number;
  cleanupIntervalMs: number;
}>;
```

Reject zero, negative, non-integer, or excessively large overrides. Return only a hex HMAC from
`fingerprintClientIp` and never log the raw address.

- [ ] **Step 5: Implement and test Next.js Proxy binding**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Match only
`/admin/:path*`, `/api/flowpanel/:path*`, and `/api/demo/:path*`. Clone request headers, overwrite
`DEMO_SANDBOX_HEADER`, pass them upstream through `NextResponse.next({ request: { headers } })`, and
set the public cookie on the response. Add pure `bindSandboxRequest(...)` coverage so the test can
assert the overwritten header and cookie options without starting Next.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/config.test.ts src/demo/sandbox/__tests__/identity.test.ts
pnpm --filter ai-scraper typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the request boundary**

```bash
git add examples/ai-scraper/proxy.ts examples/ai-scraper/src/demo/sandbox/config.ts examples/ai-scraper/src/demo/sandbox/identity.ts examples/ai-scraper/src/demo/sandbox/__tests__/config.test.ts examples/ai-scraper/src/demo/sandbox/__tests__/identity.test.ts
git commit -m "feat(demo): bind private sandbox identity"
```

---

### Task 3: Transactional scoped seed

**Files:**
- Create: `examples/ai-scraper/src/demo/sandbox/seed.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/__tests__/seed.test.ts`
- Modify: `examples/ai-scraper/scripts/seed-data.ts`
- Modify: `examples/ai-scraper/scripts/seed.ts`

**Interfaces:**
- Produces: `SEED_VERSION`, `buildSandboxSeed(data, ids)`, and `seedSandbox(db, sandboxId, now)`.
- Produces: `resetSandboxData(db, sandboxId, now)` as the same atomic path.
- Consumes: schema from Task 1 and `generateDemoData`.

- [ ] **Step 1: Write the failing pure remapping test**

Give inserted parent maps non-generator ids and prove every child points to the mapped database id:

```ts
const plan = buildSandboxSeed(data, {
  customers: new Map([[1, 101]]),
  monitors: new Map([[1, 201]]),
  runs: new Map([[1, 301]]),
  products: new Map([[1, 401]]),
  listings: new Map([[1, 501]]),
});
expect(plan.monitors[0]).toMatchObject({ sandboxId, seedKey: 1, customerId: 101 });
expect(plan.matches[0]).toMatchObject({ listingId: 501, productId: 401 });
```

Also assert no generated row loses its original `seedKey` and visitor-created rows are never part
of the plan.

- [ ] **Step 2: Run the focused test and confirm red**

Run: `pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/seed.test.ts`

Expected: FAIL because `buildSandboxSeed` does not exist.

- [ ] **Step 3: Implement topological mapping and transactional persistence**

`seedSandbox` must:

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${sandboxId}, 0))`);
  // Recheck seedVersion after the lock.
  // Delete only rows where sandbox_id = sandboxId.
  // Insert each dependency layer in bulk and return { id, seedKey }.
  // Update demo_sandboxes.seed_version only after every insert succeeds.
});
```

Build maps by returned `seedKey`, never by returned array order. Throw a named error if a generated
foreign id has no map entry. `seedSandbox` upserts the `local` metadata row when the CLI calls it;
export `seedSandboxInTransaction(tx, sandboxId, now)` so lifecycle creation can reuse the same
transaction without nesting. Leave the old `scripts/seed-data.ts` as a thin re-export for one
compatibility step, then make `scripts/seed.ts` call `seedSandbox(db, "local", new Date())` and close
its pool in `finally`.

- [ ] **Step 4: Run seed tests and seed the real local database twice**

Run:

```bash
pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/seed.test.ts
pnpm --filter ai-scraper db:seed
pnpm --filter ai-scraper db:seed
```

Expected: both seed commands succeed; the second leaves exactly one coherent `local` dataset.

- [ ] **Step 5: Commit the seed boundary**

```bash
git add examples/ai-scraper/src/demo/sandbox/seed.ts examples/ai-scraper/src/demo/sandbox/__tests__/seed.test.ts examples/ai-scraper/scripts/seed-data.ts examples/ai-scraper/scripts/seed.ts
git commit -m "feat(demo): seed sandbox data transactionally"
```

---

### Task 4: Lifecycle, capacity, and cleanup service

**Files:**
- Create: `examples/ai-scraper/src/demo/sandbox/lifecycle.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/maintenance.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/service.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/__tests__/lifecycle.test.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/__tests__/maintenance.test.ts`

**Interfaces:**
- Produces: `ensureSandbox({ db, id, fingerprintHash, now, config })`.
- Produces: `resetCurrentSandbox({ db, id, now })` and `SandboxResetRateLimitError`.
- Produces: `cleanupExpiredSandboxes({ db, now, force })`.
- Consumes: `seedSandbox` from Task 3 and config values from Task 2.

- [ ] **Step 1: Write failing lifecycle decision tests**

Extract deterministic calculations and assert exact boundaries:

```ts
expect(nextDeadlines(createdAt, now, config)).toEqual({
  inactivityExpiresAt: new Date(now.getTime() + 60 * 60_000),
  absoluteExpiresAt: new Date(createdAt.getTime() + 24 * 60 * 60_000),
});
expect(shouldTouch(lastSeenAt, new Date(lastSeenAt.getTime() + 299_999))).toBe(false);
expect(shouldTouch(lastSeenAt, new Date(lastSeenAt.getTime() + 300_000))).toBe(true);
expect(canReset(lastResetAt, new Date(lastResetAt.getTime() + 4_999))).toBe(false);
```

- [ ] **Step 2: Write failing maintenance coordination tests**

Use a small fake repository interface to prove cleanup runs only when the 15-minute conditional
maintenance claim succeeds, deletes both inactivity-expired and absolute-expired sandboxes, and
returns structured counts.

- [ ] **Step 3: Run focused tests and confirm red**

Run: `pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/lifecycle.test.ts src/demo/sandbox/__tests__/maintenance.test.ts`

Expected: FAIL because lifecycle and maintenance modules do not exist.

- [ ] **Step 4: Implement the database service with explicit errors**

Define `SandboxCapacityError`, `SandboxCreationRateLimitError`, and
`SandboxResetRateLimitError`. New-sandbox creation runs one transaction that:

1. acquires the creation advisory lock;
2. performs due cleanup;
3. checks active count and one-hour fingerprint count;
4. inserts metadata;
5. seeds after the per-sandbox lock is acquired.

Existing sandbox requests skip creation limits, coalesce `lastSeenAt`, and reseed when
`seedVersion !== SEED_VERSION`. Log structured JSON without cookie ids, raw IPs, or secrets.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/lifecycle.test.ts src/demo/sandbox/__tests__/maintenance.test.ts
pnpm --filter ai-scraper typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit lifecycle infrastructure**

```bash
git add examples/ai-scraper/src/demo/sandbox/lifecycle.ts examples/ai-scraper/src/demo/sandbox/maintenance.ts examples/ai-scraper/src/demo/sandbox/service.ts examples/ai-scraper/src/demo/sandbox/__tests__/lifecycle.test.ts examples/ai-scraper/src/demo/sandbox/__tests__/maintenance.test.ts
git commit -m "feat(demo): manage sandbox lifecycle and limits"
```

---

### Task 5: Fail-closed FlowPanel scope and custom SQL

**Files:**
- Create: `examples/ai-scraper/src/demo/sandbox/scope.ts`
- Create: `examples/ai-scraper/src/demo/sandbox/__tests__/scope.test.ts`
- Modify: `examples/ai-scraper/src/demo/auth/session.ts`
- Modify: `examples/ai-scraper/src/admin/config/index.ts`
- Modify: `examples/ai-scraper/src/admin/config/resources/{customers,monitors,runs,offers,products,review,invoices,ai-usage}.ts`
- Modify: `examples/ai-scraper/src/admin/overview-queries.ts`
- Modify: `examples/ai-scraper/src/admin/mutations.ts`
- Modify: `examples/ai-scraper/src/lib/runner.ts`

**Interfaces:**
- Produces: `requireSandboxId(scope): string`, `sandboxScope(column)`, and `sandboxField<Row>()`.
- Consumes: `ensureSandbox` and proxy header from Tasks 2 and 4.
- Produces: `AdminSession.sandboxId` used by FlowPanel global scope.

- [ ] **Step 1: Write failing scope helper and config contract tests**

Assert missing/malformed scope throws, every resource declares a scope function, internal fields
are unreadable, and public mode disables import:

```ts
expect(() => requireSandboxId(null)).toThrow(/sandbox scope/);
for (const target of config.resources) {
  expect(typeof target.options.scope).toBe("function");
  expect(target.options.fieldAccess?.sandboxId?.read).toBe(false);
}
```

Test the hidden create field resolver with `{ scope: { sandboxId: "local" } }` and expect `local`.

- [ ] **Step 2: Run focused tests and confirm red**

Run: `pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/scope.test.ts`

Expected: FAIL because resources are unscoped.

- [ ] **Step 3: Bind session and global scope**

Read only `DEMO_SANDBOX_HEADER` from the request passed to `getDemoSession`, call
`ensureSandbox`, and return:

```ts
type AdminSession = {
  id: number;
  email: string;
  role: "admin" | "support";
  sandboxId: string;
  user: { id: string; name: string };
};
```

Configure `scope: ({ session }) => ({ sandboxId: requireSession(session).sandboxId })`,
`readOnly: readSandboxConfig().readOnly`, and `auth.userId` as the synthetic actor id.

- [ ] **Step 4: Bind every resource and create path**

Each resource receives:

```ts
scope: sandboxScope(schema.products.sandboxId),
fieldAccess: {
  sandboxId: { read: false },
  seedKey: { read: false, write: false },
},
create: { fields: [...fields, sandboxField()] },
```

Merge existing field policies rather than replacing them. Keep `sandboxId` out of exports and
drawers. Public import resolves to `false`; local import retains its existing fields.

- [ ] **Step 5: Scope custom queries and mutations**

Every overview query and dynamic customer option adds
`eq(table.sandboxId, requireSandboxId(ctx.scope))`. Custom mutations include both sandbox and row
ids:

```ts
.where(
  and(
    eq(schema.matches.sandboxId, requireSandboxId(ctx.scope)),
    eq(schema.matches.id, row.id),
  ),
);
```

Pass sandbox id into `retryRun` rather than letting the helper issue an id-only query.

- [ ] **Step 6: Run unit tests, typecheck, seed, and a local smoke**

Run:

```bash
pnpm --filter ai-scraper test:unit
pnpm --filter ai-scraper typecheck
pnpm --filter ai-scraper db:seed
```

Then open `/admin`, `/admin/products`, and `/admin/review`; expect populated scoped rows and no
server error.

- [ ] **Step 7: Commit runtime scoping**

```bash
git add examples/ai-scraper/src/demo/sandbox/scope.ts examples/ai-scraper/src/demo/sandbox/__tests__/scope.test.ts examples/ai-scraper/src/demo/auth/session.ts examples/ai-scraper/src/admin/config examples/ai-scraper/src/admin/overview-queries.ts examples/ai-scraper/src/admin/mutations.ts examples/ai-scraper/src/lib/runner.ts
git commit -m "feat(demo): scope every operation to one sandbox"
```

---

### Task 6: Reset route and interactive notice

**Files:**
- Create: `examples/ai-scraper/app/api/demo/reset/route.ts`
- Create: `examples/ai-scraper/src/demo/ui/DemoSandboxNotice.tsx`
- Create: `examples/ai-scraper/src/demo/ui/__tests__/DemoSandboxNotice.test.tsx`
- Create: `examples/ai-scraper/src/demo/sandbox/__tests__/reset-route.test.ts`
- Modify: `examples/ai-scraper/app/layout.tsx`
- Modify: `examples/ai-scraper/src/demo/ui/DemoPersonaGuide.tsx`

**Interfaces:**
- Consumes: bound request header and `resetCurrentSandbox`.
- Produces: `POST /api/demo/reset` JSON `{ ok: true }` or stable 403/429/503 envelopes.
- Produces: notice copy and client reset state machine.

- [ ] **Step 1: Write failing route security tests**

Mock the sandbox service and prove that missing/cross-origin `Origin`, absent internal sandbox
header, and caller-supplied `sandboxId` never invoke reset. Assert cooldown maps to 429.

```ts
const response = await POST(
  new Request("http://demo.test/api/demo/reset", {
    method: "POST",
    headers: { origin: "https://attacker.test" },
  }),
);
expect(response.status).toBe(403);
expect(resetCurrentSandbox).not.toHaveBeenCalled();
```

- [ ] **Step 2: Write failing notice-copy tests**

Keep state-to-copy mapping pure and assert interactive, pending, restored, rate-limited, failure,
and emergency read-only text. Static rendering must include `Private to this browser` and the
60-minute inactivity statement.

- [ ] **Step 3: Run focused tests and confirm red**

Run: `pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/reset-route.test.ts src/demo/ui/__tests__/DemoSandboxNotice.test.tsx`

Expected: FAIL because route and notice do not exist.

- [ ] **Step 4: Implement same-origin reset and status mapping**

Require exact `Origin === new URL(req.url).origin` and reject `Sec-Fetch-Site` values other than
`same-origin` when present. Read the sandbox only from the proxy header. Map named service errors
to stable JSON and avoid returning database messages.

- [ ] **Step 5: Implement the accessible notice**

Use a client component with `useTransition`, `fetch("/api/demo/reset", { method: "POST" })`, and
`router.refresh()`. Disable the button while pending, announce status through `aria-live="polite"`,
preserve the current admin URL, and retain the existing 44px mobile hit target. In emergency
read-only mode render no reset button and say editing is temporarily disabled.

- [ ] **Step 6: Run focused tests, typecheck, and browser smoke**

Run:

```bash
pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/reset-route.test.ts src/demo/ui/__tests__/DemoSandboxNotice.test.tsx
pnpm --filter ai-scraper typecheck
```

In the browser edit one product, reload, reset, and verify the original value returns without a
route change.

- [ ] **Step 7: Commit reset UX**

```bash
git add examples/ai-scraper/app/api/demo/reset/route.ts examples/ai-scraper/app/layout.tsx examples/ai-scraper/src/demo/ui/DemoSandboxNotice.tsx examples/ai-scraper/src/demo/ui/DemoPersonaGuide.tsx examples/ai-scraper/src/demo/ui/__tests__/DemoSandboxNotice.test.tsx examples/ai-scraper/src/demo/sandbox/__tests__/reset-route.test.ts
git commit -m "feat(demo): add private sandbox reset experience"
```

---

### Task 7: Operational scripts and deployment contract

**Files:**
- Create: `examples/ai-scraper/src/demo/sandbox/__tests__/scripts.test.ts`
- Create: `examples/ai-scraper/scripts/cleanup-demo.ts`
- Modify: `examples/ai-scraper/scripts/reset-demo.ts`
- Modify: `examples/ai-scraper/package.json`
- Modify: `examples/ai-scraper/Dockerfile`
- Modify: `examples/ai-scraper/docker-compose.demo.yml`
- Modify: `examples/ai-scraper/.env.example`
- Modify: `examples/ai-scraper/README.md`
- Modify: `packages/e2e/global-setup.ts`

**Interfaces:**
- Produces: `pnpm --filter ai-scraper demo:cleanup` and sandbox-targeted `demo:reset`.
- Consumes: lifecycle/maintenance services from Task 4.
- Produces: a container that pushes schema and starts without global seed.

- [ ] **Step 1: Write failing CLI help assertions**

Add a small unit test that imports exported help strings and asserts reset defaults to `local`,
cleanup documents `--force`, and neither command promises global `TRUNCATE`.

- [ ] **Step 2: Run the focused test and confirm red**

Run: `pnpm --filter ai-scraper test:unit -- src/demo/sandbox/__tests__/scripts.test.ts`

Expected: FAIL because cleanup and scoped help do not exist.

- [ ] **Step 3: Implement scoped reset and cleanup entry points**

`reset-demo.ts` accepts `--sandbox local` and rejects arbitrary public-cookie reset unless the
operator provides an explicit UUID. `cleanup-demo.ts` calls forced maintenance and prints one JSON
summary. Both close the PostgreSQL pool in `finally` and exit non-zero on failure.

- [ ] **Step 4: Update deployment behavior and documentation**

Change the Docker command to `pnpm db:push && pnpm start`. Add the required 32+ character secret,
trusted proxy requirement, limits, emergency read-only, lazy cleanup, manual reset, and public
import limitation to `.env.example`, compose, and README. Keep `db:seed` in local and E2E setup.

- [ ] **Step 5: Run help, cleanup, Docker config, and build checks**

Run:

```bash
pnpm --filter ai-scraper demo:reset -- --help
pnpm --filter ai-scraper demo:cleanup -- --help
docker compose -f examples/ai-scraper/docker-compose.demo.yml config
pnpm --filter ai-scraper build
```

Expected: commands describe scoped behavior, compose validates, and production build passes.

- [ ] **Step 6: Commit the operational contract**

```bash
git add examples/ai-scraper/scripts examples/ai-scraper/package.json examples/ai-scraper/Dockerfile examples/ai-scraper/docker-compose.demo.yml examples/ai-scraper/.env.example examples/ai-scraper/README.md packages/e2e/global-setup.ts
git commit -m "docs(demo): operate isolated public sandboxes"
```

---

### Task 8: Real database and two-browser E2E proof

**Files:**
- Create: `packages/e2e/tests/demo-sandbox.spec.ts`
- Create: `packages/e2e/tests/demo-readonly.spec.ts`
- Create: `packages/e2e/playwright.demo-readonly.config.ts`
- Modify: `packages/e2e/playwright.config.ts`
- Modify: `packages/e2e/package.json`
- Modify: `packages/e2e/tests/demo-public-mode.spec.ts`
- Modify: `packages/e2e/tests/release-shell.spec.ts`

**Interfaces:**
- Consumes: the complete sandbox implementation.
- Produces: release evidence for persistence, isolation, direct-request rejection, reset, role
  sharing, mobile UX, and emergency read-only.

- [ ] **Step 1: Enable isolated public mode in E2E**

Pass `DEMO_MODE=true` and a fixed 32+ character test secret to the main Playwright web server. Keep
the E2E database disposable and single-worker. Replace the old public-read-only assertion with the
interactive notice contract. Add `playwright.demo-readonly.config.ts` on port 3101 with
`DEMO_READ_ONLY=true`, one Chromium project, and only `demo-readonly.spec.ts`; expose it as
`test:demo-readonly` in the E2E package.

- [ ] **Step 2: Write the two-context acceptance journey**

Create browser contexts A and B with distinct cookie jars. In A:

1. assert seeded product exists;
2. create a uniquely named product through the UI;
3. edit it and reload;
4. delete a disposable row and verify it stays deleted;
5. perform one review action.

In B assert the created title and A's changed counts are absent. Capture an A row id and send B
direct GET/PATCH/DELETE requests; assert 404 or the existing non-disclosing forbidden response.

- [ ] **Step 3: Add reset, role-sharing, and mobile assertions**

Reset A and assert the seed returns while B remains unchanged. Switch A from Admin to Support and
assert the sandbox data persists while admin-only pricing disappears. Tag the notice/reset subset
`@cross-browser` and verify the reset control is at least 44px high on Pixel 7.

- [ ] **Step 4: Run the new focused E2E contract**

Run: `pnpm --filter @flowpanel/e2e test:e2e -- --project=chromium --grep "sandbox"`

Expected: PASS. If a contract fails, diagnose the smallest responsible implementation boundary,
add or strengthen its focused regression test, fix it, and rerun this contract.

- [ ] **Step 5: Run all demo E2E projects**

Run: `pnpm --filter @flowpanel/e2e test:e2e`

Expected: Chromium, mobile Chrome, and WebKit release-shell coverage passes; no former read-only
test contradicts the interactive public mode.

Run: `pnpm --filter @flowpanel/e2e test:demo-readonly`

Expected: the emergency server shows the temporary read-only notice, hides mutation affordances,
and rejects a direct create request with 403.

- [ ] **Step 6: Commit E2E release evidence**

```bash
git add packages/e2e/package.json packages/e2e/playwright.config.ts packages/e2e/playwright.demo-readonly.config.ts packages/e2e/tests/demo-sandbox.spec.ts packages/e2e/tests/demo-readonly.spec.ts packages/e2e/tests/demo-public-mode.spec.ts packages/e2e/tests/release-shell.spec.ts
git commit -m "test(demo): prove private interactive sandboxes"
```

---

### Task 9: Final verification and visual release gate

**Files:**
- Modify only when a verification failure identifies an in-scope defect.

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: a factual release-readiness report; no partial check permits a completion claim.

- [ ] **Step 1: Run static and unit gates**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run database and browser gates**

Run:

```bash
pnpm test:e2e
pnpm --filter @flowpanel/e2e test:demo-readonly
pnpm --filter @flowpanel/e2e test:site
```

Expected: all non-explicitly-skipped tests pass, including two-browser sandbox isolation.

- [ ] **Step 3: Perform skeptical visual QA**

Start landing/docs and demo with public mode. Inspect desktop 1440×900 and mobile 375×812 in dark
and light themes. Verify:

- interactive notice is readable without dominating the admin;
- reset has pending/success/failure feedback and no layout shift;
- create/edit/delete forms remain obvious;
- Admin/Support switch preserves sandbox data;
- no horizontal overflow, clipped focus ring, browser console error, or touch target below 44px;
- a fresh browser is populated and a second browser is unaffected by the first.

- [ ] **Step 4: Run production-mode smoke**

Build and start the demo with `DEMO_MODE=true`, a non-test secret, and the disposable PostgreSQL
database. Use two clean browser profiles to repeat create, reload, reset, and cross-profile absence.
Then set `DEMO_READ_ONLY=true`, restart, and verify UI and direct API writes are disabled.

- [ ] **Step 5: Review the final diff for scope and secrets**

Run:

```bash
git diff --check
git status --short
rg -n "DEMO_SANDBOX_SECRET=|sandboxId.*console|fingerprintHash.*console" examples/ai-scraper
```

Expected: no whitespace errors, no committed secret, no sandbox capability or fingerprint in logs,
and no unrelated file staged by this feature.

- [ ] **Step 6: Commit verification-driven corrections**

If verification required an in-scope correction, stage only its files and commit:

```bash
git commit -m "fix(demo): close sandbox release gaps"
```

If no correction was required, do not create an empty commit. Record exact commands, pass counts,
skips, and remaining deployment-only steps in the handoff.
