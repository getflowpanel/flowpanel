# Flowpanel Canonical Demo Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `examples/ai-scraper` into a coherent, visually polished, secure, and copyable Flowpanel reference admin for a competitive price-intelligence SaaS.

**Architecture:** Keep production-shaped Flowpanel config in `src/admin`, move synthetic auth/data/realtime into `src/demo`, and generate the database from typed customer scenarios. Register exactly five primary destinations while keeping operational resources and optional BullMQ queues reachable through drawers, deep links, and the command palette.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL 16, Flowpanel packages, Vitest, Playwright, Axe, Tailwind 4, optional BullMQ/Redis.

**Spec:** `docs/superpowers/specs/2026-08-24-canonical-demo-redesign-design.md`

## Global Constraints

- Primary navigation is exactly: Overview, Customers, Monitors, Products, Review.
- Public `DEMO_MODE=true` remains read-only at the server; local mode remains interactive.
- No runtime crawler, LLM, billing, email, or other external side effect is introduced.
- `src/admin` must show the documented Flowpanel API directly; no resource/config meta-factory is allowed.
- `src/demo` owns fake personas, deterministic fixtures, reset support, and synthetic realtime.
- Flowpanel tokens and components remain the visual source of truth; no gradients, glow, glass, ornamental AI styling, or decorative dashboard cards.
- Custom admin React is limited to one realtime component and the existing small metric-card override.
- Normal text contrast is at least 4.5:1, controls have a 44×44 CSS-pixel hit area, keyboard focus stays visible, and reduced motion is respected.
- Verify at 375, 768, 1024, and 1440 CSS pixels in light and dark themes with no page-level horizontal overflow.
- Preserve unrelated dirty-worktree changes. Stage and commit only the files named by the active task.
- Use `apply_patch` for file contents; do not perform destructive checkout/reset operations.

---

### Task 1: Hide optional queues without hiding their routes

**Files:**

- Modify: `packages/core/src/types/queue.ts`
- Modify: `packages/core/types-test/index.test-d.ts`
- Modify: `packages/next/src/runtime/nav.ts`
- Modify: `packages/next/src/__tests__/nav.test.ts`
- Create: `.changeset/hide-optional-queues.md`

**Interfaces:**

- Produces: `QueueOptions.hidden?: boolean`.
- Produces: `buildNav()` excludes a queue only when `options.hidden === true`; route registration and role checks remain unchanged.
- Consumed by: Task 4 `examples/ai-scraper/src/admin/config/queues.ts`.

- [ ] **Step 1: Add the failing runtime test**

Append this case inside `describe("buildNav")`:

```ts
it("filters hidden queues without removing visible queues", () => {
  const cfg = defineAdmin({
    adapter: fakeAdapter,
    auth: { session: async () => null, role: () => "guest" },
    queues: [
      queue({ name: "scrape" }, { label: "Scrape", boardUrl: "http://localhost/scrape" }),
      queue(
        { name: "billing" },
        { label: "Billing", boardUrl: "http://localhost/billing", hidden: true },
      ),
    ],
  });

  expect(buildNav(cfg).flatMap((group) => group.items.map((item) => item.label))).toEqual([
    "Scrape",
  ]);
  expect(cfg.queuesByKey.has("billing")).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify the contract is missing**

Run: `pnpm --filter @flowpanel/next test:unit -- src/__tests__/nav.test.ts`

Expected: TypeScript/Vitest fails because `hidden` is not a `QueueOptions` property or the hidden queue remains in navigation.

- [ ] **Step 3: Add the public type contract**

Add to `QueueOptions`:

```ts
/** Keep the queue route registered but omit it from primary navigation. */
hidden?: boolean;
```

Import `QueueOptions` in `packages/core/types-test/index.test-d.ts` and add:

```ts
expectAssignable<QueueOptions>({
  label: "Scrape",
  boardUrl: "http://localhost/scrape",
  hidden: true,
});
```

- [ ] **Step 4: Filter hidden queues in `buildNav()`**

Change the queue filter to preserve the existing role check:

```ts
.filter(
  ([, q]) => !q.options.hidden && (!reqCtx || roleAllows(q.options.requireRole, reqCtx)),
)
```

- [ ] **Step 5: Add the release note**

Create `.changeset/hide-optional-queues.md`:

```md
---
"@flowpanel/core": patch
"@flowpanel/next": patch
---

Allow queue pages to remain routable while being hidden from primary admin navigation.
```

- [ ] **Step 6: Verify runtime, types, and builds**

Run:

```bash
pnpm --filter @flowpanel/next test:unit -- src/__tests__/nav.test.ts
pnpm --filter @flowpanel/core build
pnpm --filter @flowpanel/core test:types
pnpm --filter @flowpanel/next typecheck
```

Expected: all commands exit 0; the new test confirms the hidden queue remains in `queuesByKey`.

- [ ] **Step 7: Commit only Task 1**

```bash
git add packages/core/src/types/queue.ts packages/core/types-test/index.test-d.ts packages/next/src/runtime/nav.ts packages/next/src/__tests__/nav.test.ts .changeset/hide-optional-queues.md
git commit -m "feat: allow queues to stay out of primary navigation"
```

---

### Task 2: Align the disposable schema with the product language

**Files:**

- Modify: `examples/ai-scraper/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `examples/ai-scraper/src/db/__tests__/schema.test.ts`
- Modify: `examples/ai-scraper/src/db/schema.ts`
- Modify: every current `examples/ai-scraper/**/*.ts` and `*.tsx` reference to `schema.users`, `schema.scrapers`, `userId`, or `scraperId`

**Interfaces:**

- Produces: Drizzle tables `customers` and `monitors`.
- Produces: foreign keys `customerId` and `monitorId`.
- Produces: `monitorStatus` enum.
- Consumed by: scenario generator, resource configs, dashboard queries, and E2E routes in later tasks.

- [ ] **Step 1: Add the example unit-test command**

Add to `examples/ai-scraper/package.json`:

```json
"test:unit": "vitest run"
```

Add the catalog dependency under `devDependencies`:

```json
"vitest": "catalog:"
```

Run `pnpm install --lockfile-only` from the repository root so the workspace importer in `pnpm-lock.yaml` matches `package.json`.

- [ ] **Step 2: Write the failing schema-language test**

Create `src/db/__tests__/schema.test.ts`:

```ts
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "../schema";

describe("ScrapeAI domain schema", () => {
  it("uses the same customer and monitor language as the UI", () => {
    expect(getTableName(schema.customers)).toBe("customers");
    expect(getTableName(schema.monitors)).toBe("monitors");
  });

  it("exposes domain-named foreign keys", () => {
    expect(schema.monitors.customerId).toBeDefined();
    expect(schema.runs.monitorId).toBeDefined();
    expect(schema.products.customerId).toBeDefined();
    expect(schema.listings.monitorId).toBeDefined();
    expect(schema.invoices.customerId).toBeDefined();
    expect(schema.aiUsage.customerId).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the test and confirm the old names fail**

Run: `pnpm --filter ai-scraper test:unit -- src/db/__tests__/schema.test.ts`

Expected: FAIL because `customers`, `monitors`, `customerId`, and `monitorId` do not exist.

- [ ] **Step 4: Rename the schema symbols and database objects**

Apply this mapping consistently in `src/db/schema.ts`:

```text
users              -> customers
"users"            -> "customers"
scrapers           -> monitors
"scrapers"         -> "monitors"
scraperStatus       -> monitorStatus
userId              -> customerId
user_id             -> customer_id
scraperId           -> monitorId
scraper_id          -> monitor_id
usersRelations      -> customersRelations
scrapersRelations   -> monitorsRelations
```

Rename indexes to the corresponding `customers_*`, `monitors_*`, and `*_customer_idx`/`*_monitor_idx` forms. Update relation property names to `customer`, `monitors`, and `monitor`.

- [ ] **Step 5: Update all existing references without adding compatibility aliases**

Update the current seed, admin configs, live helpers, and type augmentation so TypeScript refers only to the new symbols. The registry shape becomes:

```ts
interface FlowpanelResources {
  customers: typeof schema.customers.$inferSelect;
  monitors: typeof schema.monitors.$inferSelect;
  runs: typeof schema.runs.$inferSelect;
  products: typeof schema.products.$inferSelect;
  listings: typeof schema.listings.$inferSelect;
  matches: typeof schema.matches.$inferSelect;
  invoices: typeof schema.invoices.$inferSelect;
  ai_usage: typeof schema.aiUsage.$inferSelect;
}
```

Do not export `users` or `scrapers` aliases; the goal is to make stale vocabulary fail compilation.

- [ ] **Step 6: Verify schema tests and compile integrity**

Run:

```bash
pnpm --filter ai-scraper test:unit -- src/db/__tests__/schema.test.ts
pnpm --filter ai-scraper typecheck
```

Expected: both exit 0 and `rg -n 'schema\.(users|scrapers)|\b(userId|scraperId)\b' examples/ai-scraper --glob '*.{ts,tsx}'` returns no matches.

- [ ] **Step 7: Commit only the schema-language change**

```bash
git add pnpm-lock.yaml examples/ai-scraper/package.json examples/ai-scraper/src/db/schema.ts examples/ai-scraper/src/db/__tests__/schema.test.ts examples/ai-scraper/scripts/seed-data.ts examples/ai-scraper/src/admin/config/index.ts examples/ai-scraper/src/admin/config/dashboards/overview.ts examples/ai-scraper/src/admin/config/resources/ai-usage.ts examples/ai-scraper/src/admin/config/resources/invoices.ts examples/ai-scraper/src/admin/config/resources/products.ts examples/ai-scraper/src/admin/config/resources/runs.ts examples/ai-scraper/src/admin/config/resources/scrapers.ts examples/ai-scraper/src/admin/config/resources/users.ts
git commit -m "refactor(ai-scraper): align schema with customer monitor domain"
```

---

### Task 3: Replace cyclic seed rows with typed customer scenarios

**Files:**

- Create: `examples/ai-scraper/src/demo/data/types.ts`
- Create: `examples/ai-scraper/src/demo/data/scenarios.ts`
- Create: `examples/ai-scraper/src/demo/data/variants.ts`
- Create: `examples/ai-scraper/src/demo/data/generate.ts`
- Create: `examples/ai-scraper/src/demo/data/__tests__/generate.test.ts`
- Modify: `examples/ai-scraper/scripts/seed-data.ts`
- Delete: `examples/ai-scraper/src/lib/catalog.ts`

**Interfaces:**

- Produces: `generateDemoData({ now }: { now: Date }): DemoData`.
- Produces: `SCENARIOS`, the six anchor customer stories.
- Produces: `findProductStory(productKey)` for the realtime generator.
- `DemoData` contains arrays named after insert order: customers, monitors, runs, products, listings, matches, invoices, aiUsage.
- Consumed by: `scripts/seed-data.ts` and Task 6 realtime.

- [ ] **Step 1: Write the failing generator contract tests**

Create `generate.test.ts` with this fixed clock:

```ts
import { describe, expect, it } from "vitest";
import { generateDemoData } from "../generate";

const NOW = new Date("2026-08-24T12:00:00.000Z");
const data = generateDemoData({ now: NOW });

describe("canonical demo data", () => {
  it("has stable volume and a useful review backlog", () => {
    expect(data.customers).toHaveLength(48);
    expect(data.products.length).toBeGreaterThanOrEqual(48);
    expect(data.products.length).toBeLessThanOrEqual(60);
    expect(data.monitors.length).toBeGreaterThanOrEqual(32);
    expect(data.monitors.length).toBeLessThanOrEqual(40);
    expect(data.runs.length).toBeGreaterThanOrEqual(220);
    expect(data.listings.length).toBeGreaterThanOrEqual(220);
    expect(data.matches).toHaveLength(data.listings.length);
    expect(data.matches.filter((match) => match.status === "needs_review").length).toBeGreaterThanOrEqual(24);
    expect(data.matches.filter((match) => match.status === "needs_review").length).toBeLessThanOrEqual(30);
  });

  it("keeps the complete ownership graph within one customer", () => {
    const monitorById = new Map(data.monitors.map((row) => [row.id, row]));
    const productById = new Map(data.products.map((row) => [row.id, row]));
    const listingById = new Map(data.listings.map((row) => [row.id, row]));
    for (const match of data.matches) {
      const listing = listingById.get(match.listingId);
      const product = productById.get(match.productId);
      const monitor = listing ? monitorById.get(listing.monitorId) : undefined;
      expect(listing).toBeDefined();
      expect(product).toBeDefined();
      expect(monitor?.customerId).toBe(product?.customerId);
    }
  });

  it("never rejects an exact normalized title as low confidence", () => {
    const productById = new Map(data.products.map((row) => [row.id, row]));
    const listingById = new Map(data.listings.map((row) => [row.id, row]));
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
    for (const match of data.matches.filter((row) => row.status === "rejected")) {
      expect(normalize(listingById.get(match.listingId)?.title ?? "")).not.toBe(
        normalize(productById.get(match.productId)?.title ?? ""),
      );
    }
  });

  it("keeps timestamps causal", () => {
    const runById = new Map(data.runs.map((row) => [row.id, row]));
    const listingById = new Map(data.listings.map((row) => [row.id, row]));
    for (const listing of data.listings) {
      const run = runById.get(listing.runId);
      expect(run).toBeDefined();
      expect(listing.scrapedAt.getTime()).toBeGreaterThanOrEqual(run?.startedAt.getTime() ?? 0);
      expect(listing.scrapedAt.getTime()).toBeLessThanOrEqual(run?.finishedAt?.getTime() ?? Infinity);
    }
    for (const match of data.matches) {
      expect(match.matchedAt.getTime()).toBeGreaterThanOrEqual(
        listingById.get(match.listingId)?.scrapedAt.getTime() ?? Infinity,
      );
    }
  });
});
```

- [ ] **Step 2: Run the tests and verify the generator is absent**

Run: `pnpm --filter ai-scraper test:unit -- src/demo/data/__tests__/generate.test.ts`

Expected: FAIL because `generateDemoData` does not exist.

- [ ] **Step 3: Define explicit fixture types**

`types.ts` must define these discriminants and contracts:

```ts
export type ListingVariantKind =
  | "exact"
  | "regional_variant"
  | "previous_generation"
  | "refurbished_bundle"
  | "accessory"
  | "contains_product";

export interface ListingVariant {
  kind: ListingVariantKind;
  title: string;
  confidence: number;
  status: "confirmed" | "needs_review" | "rejected";
  priceFactor: number;
}

export interface ProductStory {
  key: string;
  sku: string;
  title: string;
  brand: string;
  category: string;
  ourPriceCents: number;
  variants: readonly ListingVariant[];
}

export interface CustomerScenario {
  company: string;
  contactName: string;
  email: string;
  segment: string;
  plan: "starter" | "pro" | "business";
  marketplaces: readonly string[];
  products: readonly ProductStory[];
}
```

`DemoData` uses explicit numeric IDs so relations can be tested before database insertion. Each generated row matches the corresponding Drizzle insert shape after IDs are omitted or preserved through `GENERATED BY DEFAULT` insertion.

- [ ] **Step 4: Implement six anchor scenarios and weighted background accounts**

`scenarios.ts` defines the six approved customers from the spec. `variants.ts` provides reusable builders only for repeated variant mechanics:

```ts
export const exact = (title: string, priceFactor = 1): ListingVariant => ({
  kind: "exact",
  title,
  confidence: 0.98,
  status: "confirmed",
  priceFactor,
});
```

Product-specific ambiguous/accessory titles stay explicit in `scenarios.ts`; do not synthesize them by string replacement.

`generate.ts` expands scenarios using deterministic weighted tables and `now`. Keep first-page ordering stable by assigning recent timestamps to anchor customers without violating temporal ordering.

- [ ] **Step 5: Make the seed script a thin database writer**

Replace row-generation logic in `scripts/seed-data.ts` with:

```ts
const data = generateDemoData({ now: new Date() });

await db.transaction(async (tx) => {
  await tx.execute(sql`TRUNCATE TABLE matches, listings, products, ai_usage, runs, invoices, monitors, customers RESTART IDENTITY CASCADE`);
  await tx.insert(schema.customers).values(data.customers);
  await tx.insert(schema.monitors).values(data.monitors);
  await tx.insert(schema.runs).values(data.runs);
  await tx.insert(schema.products).values(data.products);
  await tx.insert(schema.listings).values(data.listings);
  await tx.insert(schema.matches).values(data.matches);
  await tx.insert(schema.invoices).values(data.invoices);
  await tx.insert(schema.aiUsage).values(data.aiUsage);
});
```

Keep the existing exported seed function signature used by `seed.ts` and `reset-demo.ts`. Delete `src/lib/catalog.ts` after its marketplace/product vocabulary is represented by the typed scenarios.

- [ ] **Step 6: Run unit tests and database verification**

Run:

```bash
pnpm --filter ai-scraper docker:up
pnpm --filter ai-scraper test:unit -- src/demo/data/__tests__/generate.test.ts
pnpm --filter ai-scraper typecheck
pnpm --filter ai-scraper db:push
pnpm --filter ai-scraper db:seed
```

Then verify:

```bash
docker compose -f examples/ai-scraper/docker-compose.yml exec -T postgres psql -U fp -d ai_scraper -c "select status, count(*) from matches group by status order by status;"
```

Expected: generator tests pass, seed succeeds, and `needs_review` is between 24 and 30.

- [ ] **Step 7: Commit only scenario data work**

```bash
git add examples/ai-scraper/src/demo/data examples/ai-scraper/scripts/seed-data.ts examples/ai-scraper/src/lib/catalog.ts
git commit -m "feat(ai-scraper): seed coherent price intelligence scenarios"
```

---

### Task 4: Build the five-screen config and hide supporting resources

**Files:**

- Create: `examples/ai-scraper/src/admin/config/resources/customers.ts`
- Create: `examples/ai-scraper/src/admin/config/resources/monitors.ts`
- Create: `examples/ai-scraper/src/admin/config/resources/review.ts`
- Create: `examples/ai-scraper/src/admin/config/resources/offers.ts`
- Modify: `examples/ai-scraper/src/admin/config/resources/products.ts`
- Modify: `examples/ai-scraper/src/admin/config/resources/runs.ts`
- Modify: `examples/ai-scraper/src/admin/config/resources/invoices.ts`
- Modify: `examples/ai-scraper/src/admin/config/resources/ai-usage.ts`
- Delete: `examples/ai-scraper/src/admin/config/resources/users.ts`
- Delete: `examples/ai-scraper/src/admin/config/resources/scrapers.ts`
- Delete: `examples/ai-scraper/src/admin/config/resources/matches.ts`
- Delete: `examples/ai-scraper/src/admin/config/resources/listings.ts`
- Delete if present: `examples/ai-scraper/src/admin/ShowcaseGuide.tsx`
- Modify: `examples/ai-scraper/src/admin/config/queues.ts`
- Modify: `examples/ai-scraper/src/admin/config/index.ts`
- Create: `packages/e2e/tests/demo-story.spec.ts`
- Modify: `packages/e2e/tests/m1-smoke.spec.ts`
- Modify: `packages/e2e/tests/m2.5-smoke.spec.ts`
- Modify: `packages/e2e/tests/m3-realtime.spec.ts`
- Modify: `packages/e2e/tests/m4a-a11y.spec.ts`
- Modify: `packages/e2e/tests/m4a-keyboard.spec.ts`

**Interfaces:**

- Produces primary resources: `customers`, `monitors`, `products`, `review`.
- Produces hidden resources: `runs`, `listings`/Offers, `invoices`, `ai_usage`.
- Produces exactly five nav items once Overview is included.
- Preserves stable deep links `/admin/runs`, `/admin/listings`, `/admin/invoices`, and `/admin/ai_usage`.

- [ ] **Step 1: Add a failing navigation/story smoke**

Create `demo-story.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("canonical demo exposes one coherent five-screen journey", async ({ page }) => {
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link")).toHaveText([
    "Overview",
    "Customers",
    "Monitors",
    "Products",
    "Review",
  ]);

  for (const [href, heading] of [
    ["/admin/customers", "Customers"],
    ["/admin/monitors", "Monitors"],
    ["/admin/products", "Products"],
    ["/admin/matches", "Review"],
  ] as const) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
  }

  for (const label of ["Runs", "Offers", "Invoices", "AI usage", "Demo guide", "Monitoring"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }
});
```

- [ ] **Step 2: Run only the new E2E test and confirm the old nav fails**

Run: `pnpm --filter @flowpanel/e2e test:e2e -- tests/demo-story.spec.ts --project=chromium`

Expected: FAIL showing the current overloaded tab list and old `/admin/users`/`/admin/scrapers` routes.

- [ ] **Step 3: Rebuild primary resource files without wrappers**

Use the public `resource()` DSL directly and apply these exact transformations:

| New file/export | Source behavior retained | Required changes |
|---|---|---|
| `customers.ts` / `customers` | Existing Customers CRUD, explicit grouped form, import/export, inline Company edit, soft delete, realtime, drawer action | Set registry/table name to `customers`; rename Disable user to Disable customer; add Products drawer tab filtered by `customerId`; use Monitors and Invoices tabs filtered by `customerId` |
| `monitors.ts` / `monitors` | Existing create/edit form, status/schedule filters, Pause/Resume bulk actions, related Runs/Listings | Set registry/table name to `monitors`; rename all scraper copy; use `customerId`; label the listing drawer tab Offers; keep `targetUrl` validation and safe link rendering |
| `products.ts` / `products` | Existing explicit form, searchable relation picker, price formatting, field RBAC, export, Matches drawer | Change label from Catalog to Products; reference `customers` through `customerId`; use customer and category filters; reference label is company |
| `review.ts` / `review` | Existing saved views, confidence/model/status filters, Confirm/Reject actions, related Listing/Product drawers | Keep registry name `matches`; set label/labelOne to Review/Match; use product title rather than SKU as the table reference label; rename drawer tabs Decision, Marketplace offer, Catalog product |

Each file declares its own columns, fields, filters, actions, and drawer. Reference definitions use registry names `customers`, `monitors`, `products`, and `listings`. Do not extract a shared resource builder.

- [ ] **Step 4: Mark all supporting resources hidden**

Each supporting config includes:

```ts
hidden: true,
```

Build Offers directly with `resource(schema.listings, options)`, where the explicit options object sets `name: "listings"`, `label: "Offers"`, `labelOne: "Offer"`, and `hidden: true` before declaring the existing columns, filters, disabled create behavior, and drawer. Runs owns Retry, Invoices owns the typed Refund action form, and AI usage remains machine-generated/read-only; all three also set `hidden: true`.

- [ ] **Step 5: Hide optional queues**

Construct queue options with the Task 1 contract:

```ts
queue(q.instance, {
  label: label(q.name),
  icon: "workflow",
  boardUrl: iframeBoardUrl(q.name),
  hidden: true,
})
```

- [ ] **Step 6: Reduce the main config to composition**

`index.ts` registers resources in this order:

```ts
resources: [customers, monitors, products, review, runs, offers, invoices, aiUsage],
dashboards: [overview],
queues,
```

Remove `pages` and all imports of Monitoring/ShowcaseGuide. Command-palette groups include primary destinations plus an **Operations** group linking to Runs, Offers, Invoices, and AI usage. Do not add per-row “view source” actions.

- [ ] **Step 7: Update existing E2E vocabulary and routes**

Apply this route mapping throughout the named E2E files:

```text
/admin/users       -> /admin/customers
drawer=users       -> drawer=customers
/admin/scrapers    -> /admin/monitors
drawer=scrapers    -> drawer=monitors
Catalog            -> Products
Review queue       -> Review
Disable user       -> Disable customer
```

Remove `/admin/guide` and `/admin/monitoring` assertions. Do not weaken role, CRUD, realtime, drawer, keyboard, or accessibility assertions.

- [ ] **Step 8: Verify config and navigation**

Run:

```bash
pnpm --filter ai-scraper typecheck
pnpm --filter @flowpanel/e2e test:e2e -- tests/demo-story.spec.ts tests/m1-smoke.spec.ts --project=chromium
```

Expected: exit 0; primary navigation has five entries; `/admin/runs` and other hidden deep links still render when opened directly.

- [ ] **Step 9: Check the config-size guardrail**

Run:

```bash
find examples/ai-scraper/src/admin/config -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 wc -l
```

Expected at completion of Task 6: total no greater than 968 lines, which is at least 30% below the 1,383-line baseline. Record the current intermediate count without shortening code through opaque factories.

- [ ] **Step 10: Commit only resource/IA work**

```bash
git add examples/ai-scraper/src/admin/config packages/e2e/tests
git commit -m "refactor(ai-scraper): focus the demo on five canonical screens"
```

---

### Task 5: Curate the operational Overview

**Files:**

- Create: `examples/ai-scraper/src/admin/config/overview-queries.ts`
- Create: `examples/ai-scraper/src/admin/config/overview.ts`
- Delete: `examples/ai-scraper/src/admin/config/dashboards/overview.ts`
- Delete: `examples/ai-scraper/src/admin/config/dashboards/monitoring.ts`
- Delete: `examples/ai-scraper/src/admin/config/metrics.ts`
- Modify: `examples/ai-scraper/src/admin/config/index.ts`
- Modify: `packages/e2e/tests/demo-story.spec.ts`
- Modify: `packages/e2e/tests/m2-smoke.spec.ts`

**Interfaces:**

- Produces query functions `activeMonitorCount`, `offersDiscovered`, `crawlSuccessRate`, `reviewBacklog`, `offersTrend`, and `matchQuality`.
- Produces one `overview` dashboard with the 4/8/4/8 layout from the spec.
- Consumed by: Task 6 `MarketActivity` custom widget.

- [ ] **Step 1: Add failing Overview assertions**

Extend `demo-story.spec.ts`:

```ts
await expect(page.getByText("Monitor customer catalogs, marketplace coverage, crawl health, and AI-assisted matching.")).toBeVisible();
for (const label of ["Active monitors", "Offers discovered", "Crawl success", "Needs review"]) {
  await expect(page.getByText(label, { exact: true })).toBeVisible();
}
for (const removed of ["Download brief", "Customer growth", "Daily signups", "Confidence by model"]) {
  await expect(page.getByText(removed, { exact: true })).toHaveCount(0);
}
```

- [ ] **Step 2: Run the smoke and confirm current Overview fails**

Run: `pnpm --filter @flowpanel/e2e test:e2e -- tests/demo-story.spec.ts --project=chromium`

Expected: FAIL because old metrics/actions/charts remain.

- [ ] **Step 3: Isolate domain SQL in named queries**

`overview-queries.ts` exports functions with this shape:

```ts
export async function crawlSuccessRate({ db, dateRange }: WidgetContext): Promise<string>;
export async function offersTrend({ db, dateRange }: WidgetContext): Promise<Array<{ day: string; offers: number }>>;
export async function matchQuality({ db, dateRange }: WidgetContext): Promise<Array<{ status: string; count: number }>>;
```

The percentage query returns `"—"` when the range has no completed runs rather than displaying `0%` as a real result. Trend rows are ordered by the underlying date expression, not formatted text.

- [ ] **Step 4: Compose the dashboard declaratively**

The final structure is:

```ts
dashboard({
  path: "/",
  label: "Overview",
  icon: "layout-dashboard",
  dateRange: { preset: "last7d" },
  sections: [
    {
      label: "Operations",
      description: "Monitor customer catalogs, marketplace coverage, crawl health, and AI-assisted matching.",
      columns: 4,
      widgets: [
        metric("Active monitors", activeMonitorCount, { drilldown: "/admin/monitors" }),
        metric("Offers discovered", offersDiscovered, { drilldown: "/admin/listings" }),
        metric("Crawl success", crawlSuccessRate, { drilldown: "/admin/runs" }),
        metric("Needs review", reviewBacklog, {
          drilldown: "/admin/matches",
          tone: "warn",
        }),
      ],
    },
    {
      columns: 12,
      widgets: [
        areaChart("Offers discovered", offersTrend, {
          x: "day",
          y: "offers",
          smooth: true,
          span: 8,
          drilldown: "/admin/listings",
        }),
        custom(LiveFeed, async () => ({ recent: getRecentEvents() }), {
          span: 4,
          frame: false,
        }),
      ],
    },
    {
      columns: 12,
      widgets: [
        pieChart("Match quality", matchQuality, {
          category: "status",
          value: "count",
          donut: true,
          showLegend: true,
          span: 4,
          drilldown: "/admin/matches",
        }),
        table({
          label: "Recent runs",
          resource: "runs",
          columns: ["status", "pagesCrawled", "itemsExtracted", "durationMs", "startedAt"],
          limit: 6,
          span: 8,
        }),
      ],
    },
  ],
});
```

Import the existing `LiveFeed`/`getRecentEvents` only as the independently compilable intermediate widget for this task. Task 6 replaces both with `MarketActivity`; do not refactor the realtime implementation here. Do not add a dashboard action. Use drilldowns to the registered resource paths.

- [ ] **Step 5: Verify Overview behavior**

Run:

```bash
pnpm --filter ai-scraper typecheck
pnpm --filter @flowpanel/e2e test:e2e -- tests/demo-story.spec.ts tests/m2-smoke.spec.ts --project=chromium
```

Expected: the exact four metrics and three lower widgets render; removed content is absent; changing date range changes time-based values.

- [ ] **Step 6: Commit only Overview work**

```bash
git add examples/ai-scraper/src/admin/config packages/e2e/tests/demo-story.spec.ts packages/e2e/tests/m2-smoke.spec.ts
git commit -m "refactor(ai-scraper): curate the operations overview"
```

---

### Task 6: Consolidate synthetic realtime into one canonical component

**Files:**

- Create: `examples/ai-scraper/src/demo/realtime/types.ts`
- Create: `examples/ai-scraper/src/demo/realtime/feed.ts`
- Create: `examples/ai-scraper/src/demo/realtime/__tests__/feed.test.ts`
- Create: `examples/ai-scraper/src/admin/MarketActivity.tsx`
- Create: `examples/ai-scraper/src/admin/MetricCard.tsx`
- Modify: `examples/ai-scraper/instrumentation.ts`
- Modify: `examples/ai-scraper/src/admin/config/overview.ts`
- Delete: `examples/ai-scraper/src/lib/live-feed.ts`
- Delete: `examples/ai-scraper/src/lib/live-types.ts`
- Delete: `examples/ai-scraper/src/admin/LiveStats.tsx`
- Delete: `examples/ai-scraper/src/admin/LiveFeed.tsx`
- Delete: `examples/ai-scraper/src/admin/LiveDot.tsx`
- Delete: `examples/ai-scraper/src/admin/PriorityMetricCard.tsx`
- Modify: `packages/e2e/tests/m3-realtime.spec.ts`

**Interfaces:**

- Produces: `MARKET_ACTIVITY_CHANNEL = "market-activity"`.
- Produces: `getMarketActivitySnapshot()` and `startMarketActivityTicker()`.
- Produces: `MarketActivityProps = { initial: MarketActivitySnapshot }`.
- Reuses: `findProductStory()` from Task 3; no parallel catalog constant is allowed.

- [ ] **Step 1: Write the failing feed-domain test**

Create `feed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMarketEvent } from "../feed";

describe("market activity", () => {
  it("emits a bounded event from the canonical product stories", () => {
    const event = createMarketEvent(7, new Date("2026-08-24T12:00:00.000Z"));
    expect(event.title.length).toBeGreaterThan(5);
    expect(["price_drop", "price_rise", "stock_change", "crawl_completed"]).toContain(event.kind);
    expect(event.at.toISOString()).toBe("2026-08-24T12:00:00.000Z");
    expect(event.marketplace).toMatch(/amazon|best buy|ebay|walmart|mercado libre|media markt/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm the new feed is absent**

Run: `pnpm --filter ai-scraper test:unit -- src/demo/realtime/__tests__/feed.test.ts`

Expected: FAIL because `createMarketEvent` does not exist.

- [ ] **Step 3: Implement the bounded feed**

`MarketActivitySnapshot` contains:

```ts
export interface MarketActivitySnapshot {
  connected: boolean;
  offersPerMinute: number;
  activeMonitors: number;
  events: readonly MarketEvent[]; // always newest-first, maximum five
}
```

The server keeps a ring buffer of at most 20 events but serializes only five. `createMarketEvent(index, at)` is deterministic and pure. The ticker publishes every two seconds only when `DEMO_LIVE !== "off"`.

Move the unchanged small theme override from `PriorityMetricCard.tsx` to `MetricCard.tsx`, rename its export to `MetricCard`, and update the `theme.components.MetricCard` assignment in the main config. This removes the implementation-detail word “Priority” without adding behavior.

- [ ] **Step 4: Implement one accessible client component**

`MarketActivity.tsx`:

- renders a standard framed Flowpanel widget rather than a custom ornamental card;
- subscribes with `useLiveChannel(MARKET_ACTIVITY_CHANNEL, initial)`;
- shows compact throughput and active-monitor values above five events;
- labels connection state in text and `aria-live="polite"`;
- uses tabular currency and timestamps;
- never relies on red/green alone;
- respects `prefers-reduced-motion` through existing tokens/classes;
- targets 80–100 readable lines.

Overview registers it as:

```ts
custom(MarketActivity, async () => ({ initial: getMarketActivitySnapshot() }), {
  span: 4,
});
```

- [ ] **Step 5: Update startup and realtime E2E**

`instrumentation.ts` imports only `startMarketActivityTicker`. Extend `m3-realtime.spec.ts` with an Overview assertion that the live region receives a changed event within 5 seconds while retaining the existing cross-tab resource refresh test.

- [ ] **Step 6: Verify realtime and code-size targets**

Run:

```bash
pnpm --filter ai-scraper test:unit -- src/demo/realtime/__tests__/feed.test.ts
pnpm --filter ai-scraper typecheck
pnpm --filter @flowpanel/e2e test:e2e -- tests/m3-realtime.spec.ts --project=chromium
wc -l examples/ai-scraper/src/admin/MarketActivity.tsx examples/ai-scraper/src/admin/MetricCard.tsx
```

Expected: all tests pass; combined custom admin React is no greater than 176 lines, at least 40% below the 294-line baseline.

- [ ] **Step 7: Commit only realtime consolidation**

```bash
git add examples/ai-scraper/src/demo/realtime examples/ai-scraper/src/admin examples/ai-scraper/src/lib/live-feed.ts examples/ai-scraper/src/lib/live-types.ts examples/ai-scraper/instrumentation.ts examples/ai-scraper/src/admin/config/overview.ts packages/e2e/tests/m3-realtime.spec.ts
git commit -m "refactor(ai-scraper): consolidate realtime market activity"
```

---

### Task 7: Simplify the host shell and isolate demo-only authentication

**Files:**

- Create: `examples/ai-scraper/src/demo/auth/role.ts`
- Create: `examples/ai-scraper/src/demo/auth/session.ts`
- Create: `examples/ai-scraper/src/demo/auth/__tests__/role.test.ts`
- Delete: `examples/ai-scraper/src/lib/demo-role.ts`
- Delete: `examples/ai-scraper/src/lib/auth.ts`
- Modify: `examples/ai-scraper/app/api/demo/role/route.ts`
- Modify: `examples/ai-scraper/src/admin/config/index.ts`
- Modify: `examples/ai-scraper/app/layout.tsx`
- Modify: `examples/ai-scraper/app/page.tsx`
- Modify: `examples/ai-scraper/app/globals.css`
- Modify: `packages/e2e/tests/release-shell.spec.ts`

**Interfaces:**

- Produces: `resolveDemoRole(cookieHeader): "admin" | "support"` in `src/demo`.
- Produces: `getDemoSession(req): Promise<AdminSession>` in `src/demo`.
- Keeps the existing `/api/demo/role` POST contract for the persona switch.

- [ ] **Step 1: Move and strengthen the role contract test first**

Create the new test before deleting the old one:

```ts
import { describe, expect, it } from "vitest";
import { resolveDemoRole } from "../role";

describe("demo role", () => {
  it("accepts only admin and support", () => {
    expect(resolveDemoRole(null)).toBe("admin");
    expect(resolveDemoRole("flowpanel-demo-role=support")).toBe("support");
    expect(resolveDemoRole("flowpanel-demo-role=owner")).toBe("admin");
    expect(resolveDemoRole("flowpanel-demo-role=%00support")).toBe("admin");
  });
});
```

Run: `pnpm --filter ai-scraper test:unit -- src/demo/auth/__tests__/role.test.ts`

Expected: FAIL until the auth module is moved.

- [ ] **Step 2: Move demo-only auth without changing security behavior**

Keep the allow-list behavior and the two synthetic identities. Rename `getSession` to `getDemoSession` so the main config cannot be mistaken for production auth. Its comment must state that a real application replaces the entire `src/demo/auth` module.

- [ ] **Step 3: Rewrite release-shell assertions before the UI**

Update `release-shell.spec.ts` to require:

```ts
await expect(page.getByRole("heading", { level: 1 })).toContainText("price intelligence");
await expect(page.getByRole("link", { name: "Open admin" })).toBeVisible();
await expect(page.getByRole("link", { name: "View source" })).toBeVisible();
await expect(page.getByRole("link", { name: /star/i })).toHaveCount(0);
```

On `/admin`, require visible `ScrapeAI` and `Competitive price intelligence`, persona buttons, and Source. Preserve the page-overflow and 44px mobile checks. Remove all Demo guide and Download brief assertions.

- [ ] **Step 4: Simplify the host header**

Delete the inline GitHub SVG and Star CTA. Render:

```text
ScrapeAI
Competitive price intelligence
Admin / Support
Source
```

Use one compact row at desktop widths and a deliberate two-row wrap on small screens. Keep the first skip link. The public banner copy is exactly:

```text
Public sandbox · Data resets hourly · Editing is disabled
```

The footer contains one subdued “Built with Flowpanel” statement and one config link; it does not repeat multiple repository CTAs.

- [ ] **Step 5: Simplify the root welcome page**

The page structure is: eyebrow, benefit-led heading, three-sentence product explanation, **Open admin** primary action, **View source** secondary link, and a compact three-step product flow:

```text
Monitor marketplaces → Match offers to products → Review uncertain results
```

Remove the six generic capability cards. Do not replace them with another bento/card grid.

- [ ] **Step 6: Verify auth, shell, responsiveness, and build**

Run:

```bash
pnpm --filter ai-scraper test:unit -- src/demo/auth/__tests__/role.test.ts
pnpm --filter ai-scraper typecheck
pnpm --filter @flowpanel/e2e test:e2e -- tests/release-shell.spec.ts --project=chromium --project=mobile-chrome --project=webkit
pnpm --filter ai-scraper build
```

Expected: all commands exit 0; no page-level overflow; mobile controls meet 44px; Star, Guide, and Download brief are absent.

- [ ] **Step 7: Commit only shell/auth work**

```bash
git add examples/ai-scraper/src/demo/auth examples/ai-scraper/src/lib/auth.ts examples/ai-scraper/src/lib/demo-role.ts examples/ai-scraper/app examples/ai-scraper/src/admin/config/index.ts packages/e2e/tests/release-shell.spec.ts
git commit -m "refactor(ai-scraper): clarify the product shell and demo boundary"
```

---

### Task 8: Rewrite the canonical example documentation from running behavior

**Files:**

- Modify: `examples/ai-scraper/README.md`
- Create: `examples/ai-scraper/public/scrapeai-overview-dark.png`
- Modify: `docs/superpowers/specs/2026-06-15-scrapeai-price-intelligence-design.md`
- Modify: `docs/superpowers/plans/2026-06-15-scrapeai-price-intelligence.md`
- Modify: `apps/site/src/shared/lib/site-config.ts` only if its live-demo/source targets or labels no longer match the running routes

**Interfaces:**

- Produces one concise source-of-truth README for setup, tour, code mapping, data, security, and deployment.
- Produces one current Overview screenshot with meaningful alt text.
- Marks the June design and plan as superseded by the approved August spec/plan.

- [ ] **Step 1: Add documentation assertions to the existing docs checker**

Extend `scripts/check-docs.ts` immediately before its final `if (problems.length > 0)` block. Reuse the checker's existing `problems` array:

```ts
const demoReadme = readFileSync(join(ROOT, "examples/ai-scraper/README.md"), "utf8");
for (const required of [
  "Competitive price intelligence",
  "Customers",
  "Monitors",
  "Products",
  "Review",
  "src/admin/config/index.ts",
  "src/demo/data/scenarios.ts",
  "DEMO_MODE=true",
]) {
  if (!demoReadme.includes(required)) {
    problems.push(`examples/ai-scraper/README.md: missing ${required}`);
  }
}
for (const removed of ["/admin/guide", "/admin/monitoring", "Download brief"]) {
  if (demoReadme.includes(removed)) {
    problems.push(`examples/ai-scraper/README.md: still documents ${removed}`);
  }
}
```

- [ ] **Step 2: Run the checker and verify the old README fails**

Run: `pnpm check:docs`

Expected: FAIL on outdated Demo guide/Monitoring copy or missing new paths.

- [ ] **Step 3: Rewrite README in the approved order**

Use these exact top-level sections:

```md
# ScrapeAI — the canonical Flowpanel demo
## Run locally
## Five-screen tour
## Feature-to-code map
## Data model and reset
## Public demo safety
## Optional queues
## Deploy
```

Keep the five-screen tour to one short paragraph per screen. The feature map is a table from capability to exact file. Do not enumerate every click or restate the full API reference.

- [ ] **Step 4: Capture the real screenshot**

Start the seeded demo, set dark mode, open `/admin` at 1440×1000, and capture the Overview after the live component has content. Save the actual browser screenshot to `examples/ai-scraper/public/scrapeai-overview-dark.png`; do not create a mockup. Reference it as:

```md
![ScrapeAI operations overview showing monitor health, marketplace offers, AI match quality, and recent crawl runs](./public/scrapeai-overview-dark.png)
```

- [ ] **Step 5: Mark the old documents as superseded**

Add directly below each June document title:

```md
> Superseded by `docs/superpowers/specs/2026-08-24-canonical-demo-redesign-design.md` and `docs/superpowers/plans/2026-08-24-canonical-demo-redesign.md`. Do not implement this document.
```

- [ ] **Step 6: Verify docs and links**

Run:

```bash
pnpm check:docs
pnpm --filter @flowpanel/site test:unit
pnpm --filter @flowpanel/site build
```

Expected: all exit 0 and the README screenshot/link renders from GitHub-relative paths.

- [ ] **Step 7: Commit only documentation work**

```bash
git add scripts/check-docs.ts examples/ai-scraper/README.md examples/ai-scraper/public/scrapeai-overview-dark.png docs/superpowers/specs/2026-06-15-scrapeai-price-intelligence-design.md docs/superpowers/plans/2026-06-15-scrapeai-price-intelligence.md
git commit -m "docs: make ScrapeAI the canonical Flowpanel example"
```

If Task 8 actually changes `apps/site/src/shared/lib/site-config.ts`, inspect that file's complete diff to separate earlier landing-page work, then stage it explicitly in the same commit. Do not stage it merely because it was already dirty.

---

### Task 9: Run the release gate and fix only demonstrated failures

**Files:**

- Modify: only files implicated by failing checks from this task
- Modify: `packages/e2e/tests/demo-story.spec.ts` only to strengthen assertions, never to weaken expected behavior

**Interfaces:**

- Produces: release evidence for types, units, E2E, build, accessibility, security, visual responsiveness, and code-size targets.
- Does not introduce new product scope.

- [ ] **Step 1: Run formatting and static verification**

Run:

```bash
pnpm exec biome check examples/ai-scraper packages/core/src/types/queue.ts packages/core/types-test/index.test-d.ts packages/next/src/runtime/nav.ts packages/next/src/__tests__/nav.test.ts packages/e2e/tests scripts/check-docs.ts
pnpm --filter ai-scraper typecheck
pnpm --filter @flowpanel/core typecheck
pnpm --filter @flowpanel/next typecheck
pnpm check:docs
pnpm check:release
```

Expected: every command exits 0. Fix source errors; do not add ignore directives unless the rule is demonstrably incorrect for the code.

- [ ] **Step 2: Run affected unit and type tests**

Run:

```bash
pnpm --filter ai-scraper test:unit
pnpm --filter @flowpanel/core test:unit
pnpm --filter @flowpanel/core build
pnpm --filter @flowpanel/core test:types
pnpm --filter @flowpanel/next test:unit
```

Expected: every command exits 0.

- [ ] **Step 3: Recreate and verify demo data**

Run:

```bash
pnpm --filter ai-scraper docker:up
pnpm --filter ai-scraper db:push
pnpm --filter ai-scraper db:seed
pnpm --filter ai-scraper test:unit -- src/demo/data/__tests__/generate.test.ts
```

Expected: database starts, schema applies, seed completes once, and deterministic invariant tests pass.

- [ ] **Step 4: Run the focused demo E2E suite**

Run:

```bash
pnpm --filter @flowpanel/e2e test:e2e -- tests/demo-story.spec.ts tests/m1-smoke.spec.ts tests/m2-smoke.spec.ts tests/m2.5-smoke.spec.ts tests/m3-realtime.spec.ts tests/m4a-a11y.spec.ts tests/m4a-keyboard.spec.ts tests/release-shell.spec.ts
```

Expected: Chromium suite passes, and `@cross-browser` tests pass in mobile Chrome and WebKit through project filtering.

- [ ] **Step 5: Run production builds**

Run:

```bash
pnpm --filter @flowpanel/core build
pnpm --filter @flowpanel/next build
pnpm --filter @flowpanel/react build
pnpm --filter @flowpanel/kit build
pnpm --filter ai-scraper build
pnpm --filter @flowpanel/site build
```

Expected: every build exits 0 without missing exports or stale demo routes.

- [ ] **Step 6: Verify measurable code/IA constraints**

Run:

```bash
find examples/ai-scraper/src/admin/config -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 wc -l
wc -l examples/ai-scraper/src/admin/MarketActivity.tsx examples/ai-scraper/src/admin/MetricCard.tsx
rg -n 'Demo guide|Monitoring|Download brief|schema\.(users|scrapers)|\b(userId|scraperId)\b' examples/ai-scraper/app examples/ai-scraper/src examples/ai-scraper/README.md --glob '*.{ts,tsx,md}'
```

Expected: config total ≤968 lines; custom admin React total ≤176 lines; the final `rg` produces no stale runtime or documentation matches.

- [ ] **Step 7: Perform manual visual and interaction QA**

At 375, 768, 1024, and 1440 CSS pixels, in both themes:

1. Open `/`, `/admin`, and all five primary destinations.
2. Confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`.
3. Confirm the host header, five tabs, filters, table controls, drawers, and dialogs are not clipped.
4. Navigate with keyboard only; verify focus, command palette, row drawer, forms, Confirm/Reject, and dialog escape behavior.
5. Enable reduced motion and confirm realtime remains readable without decorative movement.
6. In local mode, create/edit a customer, pause/resume monitors, filter Products, confirm/reject a match, open each related drawer, and reset data.
7. In `DEMO_MODE=true`, attempt the same mutation APIs and confirm the server rejects them; verify no external queue, billing, crawling, or AI request occurs.

Record each viewport/theme result in the task handoff. Any failure is a release blocker.

- [ ] **Step 8: Review the final diff for scope and cleanliness**

Run:

```bash
git status --short
git diff --stat 10ec7e9..HEAD
git diff --check 10ec7e9..HEAD
```

Inspect the diff manually. Confirm no unrelated pre-existing changes were staged into the task commits and no generated `.next`, Playwright report, database, or environment file is tracked.

- [ ] **Step 9: Commit only release-gate fixes, if any**

If checks required source fixes, stage their exact files and commit:

```bash
git commit -m "fix(ai-scraper): close canonical demo release gaps"
```

If no source fix was required, do not create an empty commit.

---

## Final handoff evidence

Completion reporting must include:

- final primary nav labels;
- exact seeded row counts and review-backlog count;
- config/custom-component line totals against their baselines;
- unit/type/E2E/build commands and exit status;
- viewport/theme/accessibility/manual-interaction results;
- public-mode mutation/security result;
- remaining known limitations, if any, without calling the release complete while a release gate is failing.
