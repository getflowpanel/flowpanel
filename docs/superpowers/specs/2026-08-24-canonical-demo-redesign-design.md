# Flowpanel Canonical Demo Redesign

Date: 2026-08-24

Status: Approved on 2026-08-24

Scope: `examples/ai-scraper/` plus the smallest Flowpanel API change required to keep optional queues out of primary navigation.
Supersedes: `docs/superpowers/specs/2026-06-15-scrapeai-price-intelligence-design.md` and its implementation plan for all demo UX, information architecture, seed-data, and code-organization decisions.

## 1. Outcome

The `ai-scraper` example becomes the canonical Flowpanel demo: a believable internal admin for a fictional competitive price-intelligence SaaS named ScrapeAI.

A visitor must understand the product within 30 seconds:

> ScrapeAI helps online retailers monitor competitor prices and availability. It collects marketplace offers, matches inconsistent listing titles to the customer's own product catalog with AI, and sends uncertain matches to an operator for review.

The admin is used by ScrapeAI's operations team to onboard customers, configure market monitoring, watch crawl health, and resolve uncertain matches. It is not the customer-facing analytics product.

The demo has two simultaneous jobs:

1. Show a coherent, attractive, production-shaped admin that creates interest in Flowpanel.
2. Serve as copyable reference code in which every important Flowpanel feature has one clear, idiomatic example.

Success is the reaction: “That is a real, polished admin, and most of it is a small typed config.”

## 2. Design principles

1. **Product before mechanism.** Copy and metrics explain the commercial problem before mentioning crawling, queues, or AI models.
2. **Five destinations, one mental model.** Primary navigation contains exactly five items. Supporting operational tables remain reachable by drawers, deep links, and the command palette.
3. **One canonical owner per feature.** A feature appears where it is most meaningful instead of being repeated across several resources.
4. **Flowpanel stays visible.** The example uses the public Flowpanel DSL directly. Custom React is limited to the realtime market feed and a small theme override.
5. **Domain names match code names.** The disposable demo schema uses `customers` and `monitors`; the code must not call them `users` and `scrapers` while presenting different labels.
6. **Data tells connected stories.** Seed rows are generated from customer scenarios, not by cycling unrelated arrays.
7. **Minimal OSS visual language.** Neutral surfaces, one blue accent, restrained borders, useful density, and no gradients, glass effects, decorative glow, giant CTA cards, or ornamental “AI” styling.
8. **Secure public mode.** The public instance is read-only and has no external side effects. A local clone remains fully interactive.

## 3. Information architecture

### 3.1 Primary navigation

Desktop tabs, in this order:

1. **Overview** — operational health and the complete product loop at a glance.
2. **Customers** — SaaS accounts, onboarding, plan, status, and related activity.
3. **Monitors** — scheduled marketplace monitoring configured for customers.
4. **Products** — customer catalog items that ScrapeAI is trying to track.
5. **Review** — uncertain AI matches awaiting a human decision.

Each label is short enough to remain readable in the tabs shell. Icons come from the same Flowpanel/Lucide registry. The active destination is indicated by text weight and the existing underline, not color alone.

### 3.2 Supporting resources

The following resources remain registered but use `hidden: true`:

- `runs`
- `listings`, labelled **Offers** in the UI
- `invoices`
- `aiUsage`

They are reached through related-resource drawer tabs, dashboard drilldowns, explicit command-palette entries, and stable URLs. They do not consume primary navigation space.

Optional BullMQ queue pages also remain routable but hidden. `QueueOptions` gains `hidden?: boolean`, and `buildNav()` excludes hidden queues exactly as it already excludes hidden resources. This is the only planned framework-level API addition.

The separate **Monitoring** dashboard and **Demo guide** page are removed. Their useful material is absorbed into Overview, drawers, README documentation, and the command palette.

## 4. Host shell and first impression

The application header uses one compact hierarchy:

- Product: **ScrapeAI**
- Descriptor: **Competitive price intelligence**
- Secondary controls: Admin/Support persona switch and a single **Source** link

There is no GitHub Star button in the product header. Repository promotion belongs on the Flowpanel landing page, not inside the fictional product.

Public `DEMO_MODE` shows one quiet informational banner:

> Public sandbox · Data resets hourly · Editing is disabled

The banner must not compete visually with navigation. Local development omits it and enables all safe database-backed actions.

The `/` welcome page remains short. It explains the fictional product, identifies the admin as the canonical Flowpanel example, and offers one primary action, **Open admin**, plus a visually secondary **View source** link.

## 5. Screen contracts

Every primary screen answers one operational question and owns a distinct Flowpanel capability set.

### 5.1 Overview — “Is the service healthy?”

Header: **Overview**. The first section description reads:

> Monitor customer catalogs, marketplace coverage, crawl health, and AI-assisted matching.

The dashboard uses a 12-column layout and four compact metric cards:

- **Active monitors** — current count, drilldown to Monitors.
- **Offers discovered** — range-aware, drilldown to Offers.
- **Crawl success** — range-aware percentage, drilldown to Runs.
- **Needs review** — current backlog, warning tone, drilldown to Review.

Below the metrics:

- **Offers discovered** area chart, span 8. It shows a time trend based on persisted `listings.scrapedAt` data.
- **Live market activity**, span 4. A single custom realtime component shows a bounded stream of price, stock, and crawl events with a compact connection state.
- **Match quality** donut, span 4. Three categories only: confirmed, needs review, rejected.
- **Recent runs** table, span 8. It uses the registered Runs resource and links into operational detail.

There is no download-brief action, signup chart, customer-growth chart, second monitoring dashboard, duplicate throughput card, or decorative widget. The date range affects every time-based query whose label implies a period.

### 5.2 Customers — “Who uses the service?”

Customers owns the broad CRUD example:

- search, sorting, pagination, status and plan filters;
- create and edit forms with explicit grouped fields;
- inline company edit;
- CSV/JSON import and export;
- soft delete via **Disable customer**;
- Admin/Support role differences;
- drawer tabs for Profile, Monitors, Products, and Invoices;
- meaningful empty state and recovery action.

The first page contains named anchor customers with coherent catalog activity. A visitor opening a row sees a complete customer story rather than unrelated records.

### 5.3 Monitors — “What are we watching, and is it running?”

Monitors owns operational configuration and bulk actions:

- customer reference picker;
- marketplace, market, schedule, and status fields;
- filters for marketplace, schedule, and status;
- bulk Pause and Resume with confirmation;
- target URL as a safe external link;
- drawer tabs for Details, Recent runs, and Discovered offers.

UI copy uses **monitor** rather than **scraper**. A monitor name follows the business form `Amazon US · Headphones`, not a technical or category-page description.

### 5.4 Products — “Which customer products are being tracked?”

Products owns typed catalog configuration:

- SKU, product, brand, category, customer's selling price, and customer reference;
- searchable customer relation picker;
- category and customer filters;
- currency formatting and right-aligned tabular numbers;
- server-enforced field-level RBAC on commercial pricing;
- drawer tabs for Details and Matched offers;
- create, edit, search, export, and validation.

The screen is called Products in both UI and config. “Catalog” is supporting copy, not a competing resource name.

### 5.5 Review — “Which AI decisions need a human?”

Review is the primary product-value moment:

- default saved view **Needs review**;
- listing title and catalog product displayed as human-readable references;
- confidence, model, and status visible without opening a drawer;
- lowest-confidence items first;
- saved views for Needs review, Confirmed, and Rejected;
- filters for status, model, and confidence;
- conditional Confirm and Reject actions;
- server-side role guards and audit entries;
- drawer tabs for Decision, Marketplace offer, and Catalog product.

The table data must make the decision understandable. An exact model is confirmed; a neighboring generation, refurbished bundle, or regional variant requires review; an accessory or “gaming PC with RTX 4070” is rejected. Identical product and listing titles may never appear as low-confidence rejected examples.

## 6. Feature ownership matrix

| Flowpanel capability | Canonical location |
|---|---|
| Typed `defineAdmin` composition, auth, audit, rate limit, theme | Main config |
| Metrics, date range, charts, table widget, drilldowns | Overview |
| Custom component and SSE realtime | Live market activity |
| CRUD and grouped forms | Customers |
| Import/export, inline edit, soft delete | Customers |
| Relation picker and field-level RBAC | Products |
| Bulk actions | Monitors |
| Saved views and numeric-range filters | Review |
| Conditional row actions and confirmations | Review |
| Related-resource drawers | Customers, Monitors, Products, Review |
| Dense machine-generated table and cell formatters | Hidden Offers resource |
| Conditional retry with optional BullMQ integration | Hidden Runs resource |
| Typed action form | Hidden Invoices resource |
| Machine-generated read-only data | Offers and AI usage |
| Queue board integration | Hidden optional queues |
| Command palette and deep links | Main config |

No feature is duplicated solely to increase the checklist count.

## 7. Data and product storytelling

### 7.1 Scenario-first generator

Seed data is built from typed `CustomerScenario` fixtures. Each scenario owns a coherent graph:

`customer → products → monitors → runs → listings → matches → AI usage/invoices`

The six anchor customers appear first:

| Customer | Segment | Representative products |
|---|---|---|
| Northwind Audio | Headphones and speakers | Sony WH-1000XM5, AirPods Pro, Bose QC Ultra |
| Apex Gaming | PC components | RTX 4070 Super, Ryzen 9, Samsung 990 Pro |
| MobileHub Europe | Phones and wearables | iPhone 16 Pro, Pixel 10, Galaxy Watch |
| Casa Nova | Home appliances | Dyson V15, KitchenAid mixer, Roborock vacuum |
| Trail Supply Co. | Outdoor equipment | Garmin watch, Yeti cooler, Jetboil stove |
| Little Orbit | Toys and games | Nintendo Switch, LEGO sets, board games |

An additional 42 customers provide realistic pagination and filter volume. They inherit one of these segment profiles, so their products and monitors remain coherent rather than arbitrary.

### 7.2 Target volume

The deterministic reset produces:

- 48 customers;
- 48–60 products;
- 32–40 monitors;
- 220–280 runs;
- 220–300 marketplace offers;
- one AI match per offer;
- 24–30 open review decisions;
- approximately 120 invoices and 250 AI-usage rows.

These numbers are large enough to demonstrate pagination, filters, charts, and relationships without making the demo feel artificially huge.

### 7.3 Listing variants

Each anchor product defines explicit listing variants rather than copying the same title:

- exact product and model;
- color, storage, or regional variation;
- prior or neighboring generation;
- refurbished or renewed item;
- bundle with accessories;
- accessory only;
- a different product that merely contains the target model in its title.

Example for Sony WH-1000XM5:

- `Sony WH-1000XM5 Wireless Headphones · Black` — `0.98`, confirmed.
- `Sony WH-1000XM4 Noise Cancelling Headphones` — `0.72`, needs review.
- `Sony WH-1000XM5 Renewed + Travel Case` — `0.79`, needs review.
- `Replacement Ear Pads for Sony WH-1000XM5` — `0.34`, rejected.

Status and confidence correlate without becoming perfectly mechanical:

- confirmed: predominantly `0.86–0.99`;
- needs review: predominantly `0.55–0.84`;
- rejected: predominantly `0.20–0.64`;
- a small overlap near boundaries represents business rules and human decisions.

### 7.4 Referential and temporal integrity

Seed verification must enforce these invariants:

- a product belongs to the same customer as the monitor that discovered its candidate listing;
- a listing timestamp follows its run start and does not exceed the run finish;
- a match timestamp follows the listing timestamp;
- AI usage for a run occurs after the run starts;
- `monitor.lastRunAt` equals its latest run;
- successful runs have no error; failed runs have a useful error and plausible partial counts;
- invoices have internally consistent period, status, and payment timestamps;
- currency, marketplace, market, and price are compatible;
- product, listing, seller, stock, and review distributions are weighted and non-uniform;
- data spans 90 days with realistic bursts around monitor schedules.

The generator uses a fixed reference epoch or injected `now` so tests and reset output are reproducible.

## 8. Realtime behavior

Realtime remains a bounded, in-memory presentation of market activity and never writes to Postgres.

One `MarketActivity` component replaces `LiveStats`, `LiveFeed`, and `LiveDot`. It renders:

- compact current throughput and active-monitor values;
- the five most recent events;
- price old/new values, stock changes, marketplace, and event time;
- a labelled connected/reconnecting state;
- a stable server-rendered initial snapshot.

Events reuse the same anchor scenarios and listing vocabulary as the seed. They must not invent products or marketplaces outside the visible demo domain. The component targets 80–100 readable lines; it may exceed that only if accessibility behavior would otherwise be hidden or duplicated.

## 9. Code architecture

The directory boundary distinguishes copyable Flowpanel code from demo scaffolding:

```text
examples/ai-scraper/
├── app/                         # Next.js host and Flowpanel routes
├── scripts/                     # seed, reset, optional queue board
└── src/
    ├── admin/
    │   ├── config/
    │   │   ├── index.ts
    │   │   ├── overview.ts
    │   │   ├── overview-queries.ts
    │   │   ├── formatters.tsx
    │   │   ├── queues.ts
    │   │   └── resources/
    │   │       ├── customers.ts
    │   │       ├── monitors.ts
    │   │       ├── products.ts
    │   │       ├── review.ts
    │   │       ├── offers.ts
    │   │       ├── runs.ts
    │   │       ├── invoices.ts
    │   │       └── ai-usage.ts
    │   ├── MarketActivity.tsx
    │   └── MetricCard.tsx
    ├── db/                      # Drizzle client and domain-named schema
    └── demo/                    # fake session, personas, fixtures, realtime
        ├── auth/
        ├── data/
        │   ├── scenarios.ts
        │   ├── variants.ts
        │   └── generate.ts
        └── realtime/
```

Rules:

- `src/admin` contains only code a developer can reasonably copy into a production admin.
- `src/demo` contains fake authentication, deterministic fixtures, public-demo mode, reset support, and synthetic realtime.
- Resource configs use the Flowpanel DSL directly. There is no universal `makeResource`, schema-driven meta-factory, or wrapper that hides fields and actions.
- Shared helpers exist only when used at least twice or when they isolate a substantial SQL query.
- Domain SQL lives in named query functions next to Overview, leaving widget composition readable.
- Comments explain security or non-obvious constraints; they do not narrate obvious syntax.
- No single-use formatter survives merely to shorten one line.
- Imports use `@flowpanel/kit` and its documented subpaths exactly as recommended to consumers.

Code-size targets are guardrails, not code-golf requirements:

- `config/index.ts`: 50–70 lines;
- each primary resource: approximately 70–110 lines;
- each supporting resource: approximately 40–70 lines;
- Overview composition: approximately 100–140 lines, with SQL in `overview-queries.ts`;
- total `src/admin/config`: at least 30% smaller than the current 1,383 lines;
- custom admin React: at least 40% smaller than the current 294 lines.

## 10. Visual system

The demo inherits Flowpanel tokens and components. It should prove that the default product is polished without a bespoke layer of CSS.

- neutral near-black/white surfaces with one restrained blue accent;
- one border and elevation scale across cards, tables, drawers, and dialogs;
- 4/8px spacing rhythm;
- body text at least 16px on mobile and readable secondary contrast;
- tabular figures for currency, confidence, counts, and durations;
- one consistent outline icon family;
- status uses text plus badge/icon, never color alone;
- cards are content containers, not decorative rounded rectangles;
- charts use subtle grid lines, visible labels/tooltips, and at most three categorical colors;
- animations are limited to meaningful 150–300ms state transitions and respect reduced motion.

Every screen has at most one visually primary action. Secondary links and destructive actions are visibly subordinate.

## 11. Responsive and accessibility contract

The demo is verified at 375, 768, 1024, and 1440 CSS pixels in light and dark themes.

- No page-level horizontal overflow.
- The five-item tab strip may use its existing contained overflow behavior on narrow screens, but tables and code/content cards may not introduce nested horizontal scrolling into the page.
- Dashboard widgets collapse in content priority order: metrics, health trend, live activity, quality, recent runs.
- Interactive targets are at least 44×44 CSS pixels or have an equivalent expanded hit area.
- Keyboard order follows the visual order; focus rings are never removed.
- Route changes focus the main heading where supported by the shell.
- Drawers, action dialogs, dropdowns, filters, and the command palette are fully keyboard operable.
- Normal text contrast is at least 4.5:1 in both themes.
- Charts have an accessible textual label or summary and never depend on color alone.
- Live connection and mutation feedback use polite live regions and do not steal focus.
- Empty, error, loading, disabled, and reconnecting states state both the condition and the next available action.

## 12. Public-demo security and behavior

- `DEMO_MODE=true` keeps server-side `readOnly` enabled; hiding buttons alone is not accepted.
- Public demo authentication accepts only the allow-listed `admin` and `support` personas; malformed or arbitrary cookie values resolve to the safe default rather than becoming roles.
- Admin and Support demonstrate authorization differences without impersonating real accounts.
- Billing remains a local stub; no Stripe, email, crawling, or LLM API call occurs.
- Optional queue controls require `BOARD_TOKEN`; queues are not exposed when Redis is absent.
- Rate limiting and audit logging remain enabled.
- Public copy clearly distinguishes synthetic data and the hourly reset.
- Local mode enables CRUD, review actions, bulk operations, and reset so developers can test the full reference implementation.

## 13. Documentation contract

`examples/ai-scraper/README.md` becomes a concise guide rather than a feature inventory wall.

Order:

1. Product story in three sentences.
2. One current dark-mode Overview screenshot with meaningful alt text, followed by **Run locally**.
3. Five-screen guided tour.
4. Mapping from each Flowpanel feature to its exact config file.
5. Data model and deterministic reset.
6. Public-demo safety and optional queues.
7. Deployment notes.

The README, root welcome page, landing-page demo link, and admin labels use the same terms: Customers, Monitors, Products, Offers, Matches, and Review. The June spec and plan receive a short superseded notice so future contributors do not implement their old navigation.

## 14. Verification and release gate

### Automated

- Unit-test the scenario generator and all referential/temporal invariants.
- Unit-test confidence/status distributions and ensure rejected low-confidence samples are not exact title matches.
- Add nav tests proving exactly five primary demo entries and hidden queues/resources do not appear.
- Type-test `QueueOptions.hidden`.
- Preserve and update CRUD, role, field-RBAC, realtime, keyboard, and accessibility E2E coverage.
- Add a demo-story smoke test that opens Overview, Customers, Monitors, Products, and Review and verifies their defining content.
- Run example typecheck and production build.
- Run affected package unit/type tests and Flowpanel package builds.

### Visual/manual

- Verify 375/768/1024/1440 widths, both themes, keyboard-only navigation, and reduced motion.
- Confirm no page-level horizontal scroll and no clipped header or table controls.
- Confirm first viewport explains the product without reading README.
- Confirm first-page rows tell coherent anchor-customer stories.
- In local mode: create/edit a customer, pause/resume monitors, filter products, confirm/reject a match, open every related drawer, and reset data.
- In public mode: confirm all mutation paths are blocked server-side and no external side effect is reachable.

### Objective acceptance criteria

The redesign is release-ready only when all are true:

1. Primary navigation contains exactly Overview, Customers, Monitors, Products, Review.
2. A new visitor can state who ScrapeAI serves, what it monitors, why AI matching exists, and what the operator reviews.
3. Every primary resource has a distinct purpose and no duplicate showcase screen remains.
4. Seed invariants pass and all visible anchor data is commercially plausible.
5. The admin contains no page-level horizontal overflow at the four target widths.
6. Public mode blocks writes at the server and local mode demonstrates the full interaction set.
7. `src/admin/config` is at least 30% smaller and contains no abstraction that hides the Flowpanel API.
8. Typecheck, affected unit/type tests, E2E smoke/accessibility tests, and production build pass.
9. README terminology and behavior match the running demo exactly.

## 15. Implementation sequence

1. Add failing navigation and seed-invariant tests that encode the target behavior.
2. Rename the disposable demo schema and resource registry to Customers and Monitors.
3. Introduce typed scenario fixtures and replace the cycle-based seed generator.
4. Add `QueueOptions.hidden` with core/runtime tests, then hide optional queue navigation.
5. Rebuild the config around five primary resources and four hidden supporting resources.
6. Replace the two dashboards and three realtime components with the curated Overview and one MarketActivity component.
7. Simplify the host shell, root welcome page, command palette, and public-demo messaging.
8. Rewrite the example README and mark the June documents as superseded.
9. Run automated verification, seed/DB checks, production build, and E2E suites.
10. Perform responsive, theme, keyboard, reduced-motion, and public-security QA; fix every release-gate failure before calling the demo complete.

This sequence is intentionally dependency-ordered: schema and data become truthful before the UI is judged, and documentation is written against the final running behavior rather than an intermediate config.
