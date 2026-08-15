/**
 * Idempotent (TRUNCATE + re-insert) and deterministic (no Math.random), so the
 * hourly demo reset always lands on the same state.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { MATCH_MODELS } from "../src/lib/ai-models";
import { CATALOG, SELLERS, SITES } from "../src/lib/catalog";

type Db = NodePgDatabase<typeof schema>;
type Plan = (typeof schema.planTier.enumValues)[number];
type Account = (typeof schema.accountStatus.enumValues)[number];
type Schedule = (typeof schema.scheduleKind.enumValues)[number];
type Scraper = (typeof schema.scraperStatus.enumValues)[number];
type RunState = (typeof schema.runStatus.enumValues)[number];
type Invoice = (typeof schema.invoiceStatus.enumValues)[number];
type Provider = (typeof schema.aiProvider.enumValues)[number];
type Match = (typeof schema.matchStatus.enumValues)[number];

const MINUTE = 60_000;
const HOUR = 3600_000;
const DAY = 86400_000;
/** Every generated row picks from a fixed table by `index % length`. */
const cycle = <T>(xs: readonly T[], i: number): T => {
  const v = xs[i % xs.length];
  if (v === undefined) throw new Error("seed: cycle over an empty table");
  return v;
};
const days = (n: number) => new Date(Date.now() - n * DAY);
const hours = (n: number) => new Date(Date.now() - n * HOUR);
const minutes = (n: number) => new Date(Date.now() - n * MINUTE);
/**
 * `n` days ago, but spread across the day by a deterministic per-row offset so
 * timestamps don't all land on the same minute (which reads as fake).
 */
const stampDays = (n: number, seed: number) =>
  new Date(Date.now() - n * DAY - (((seed * 7) % 22) + 1) * HOUR - ((seed * 17) % 60) * 60_000);

/** How far back the time-series tail (runs, listings, matches, AI usage) reaches. */
const SPREAD_DAYS = 75;
/**
 * Recency-weighted timestamp: most rows land in the last few days, the tail
 * stretches out to ~SPREAD_DAYS. Deterministic. This is what makes the
 * dashboard date-range picker show genuinely different data per preset
 * (Today ⊂ Yesterday ⊂ Last 7 days ⊂ Last 30 days ⊂ YTD).
 */
const spreadAt = (ordinal: number): Date => {
  const u = ((ordinal * 37) % 100) / 100; // pseudo-uniform 0..0.99
  const ms = SPREAD_DAYS * DAY * u ** 1.8 + ((ordinal * 13) % 24) * HOUR;
  return new Date(Date.now() - ms);
};

/** Customers. `createdDays` drives the Signups curve; recent signups cluster. */
const USERS: {
  email: string;
  name: string;
  company: string | null;
  plan: Plan;
  status: Account;
  createdDays: number;
}[] = [
  {
    email: "marcus.lindqvist@northwind.io",
    name: "Marcus Lindqvist",
    company: "Northwind Labs",
    plan: "business",
    status: "active",
    createdDays: 72,
  },
  {
    email: "priya@brightfunnel.com",
    name: "Priya Nair",
    company: "BrightFunnel",
    plan: "pro",
    status: "active",
    createdDays: 64,
  },
  {
    email: "tomas.novak@datafox.cz",
    name: "Tomáš Novák",
    company: "DataFox",
    plan: "pro",
    status: "active",
    createdDays: 58,
  },
  {
    email: "aisha.okafor@gmail.com",
    name: "Aisha Okafor",
    company: null,
    plan: "starter",
    status: "active",
    createdDays: 51,
  },
  {
    email: "l.weber@retailpulse.de",
    name: "Lukas Weber",
    company: "RetailPulse",
    plan: "business",
    status: "active",
    createdDays: 47,
  },
  {
    email: "sofia@trendly.io",
    name: "Sofia Romano",
    company: "Trendly",
    plan: "pro",
    status: "past_due",
    createdDays: 44,
  },
  {
    email: "dkim@scoutlabs.co",
    name: "Daniel Kim",
    company: "Scout Labs",
    plan: "starter",
    status: "active",
    createdDays: 40,
  },
  {
    email: "emma.larsen@outlook.com",
    name: "Emma Larsen",
    company: null,
    plan: "free",
    status: "active",
    createdDays: 36,
  },
  {
    email: "h.tanaka@kprice.jp",
    name: "Hiroshi Tanaka",
    company: "KPrice",
    plan: "pro",
    status: "active",
    createdDays: 33,
  },
  {
    email: "olivia@marketmesh.com",
    name: "Olivia Brooks",
    company: "MarketMesh",
    plan: "business",
    status: "active",
    createdDays: 29,
  },
  {
    email: "ahmed.hassan@gulfdata.ae",
    name: "Ahmed Hassan",
    company: "GulfData",
    plan: "starter",
    status: "trialing",
    createdDays: 26,
  },
  {
    email: "nina.petrova@proton.me",
    name: "Nina Petrova",
    company: null,
    plan: "free",
    status: "active",
    createdDays: 23,
  },
  {
    email: "carlos@precolista.com.br",
    name: "Carlos Mendes",
    company: "PrecoLista",
    plan: "pro",
    status: "active",
    createdDays: 20,
  },
  {
    email: "wei.chen@pandadeals.cn",
    name: "Wei Chen",
    company: "PandaDeals",
    plan: "business",
    status: "active",
    createdDays: 18,
  },
  {
    email: "julia.schmidt@gmail.com",
    name: "Julia Schmidt",
    company: null,
    plan: "free",
    status: "canceled",
    createdDays: 16,
  },
  {
    email: "ravi@stackscout.in",
    name: "Ravi Desai",
    company: "StackScout",
    plan: "starter",
    status: "active",
    createdDays: 13,
  },
  {
    email: "grace@safaricart.ke",
    name: "Grace Mwangi",
    company: "SafariCart",
    plan: "starter",
    status: "trialing",
    createdDays: 11,
  },
  {
    email: "felix@nordicleads.se",
    name: "Felix Andersson",
    company: "NordicLeads",
    plan: "pro",
    status: "active",
    createdDays: 9,
  },
  {
    email: "mia.rossi@icloud.com",
    name: "Mia Rossi",
    company: null,
    plan: "free",
    status: "trialing",
    createdDays: 6,
  },
  {
    email: "pavel@cenikbot.cz",
    name: "Pavel Horák",
    company: "CenikBot",
    plan: "starter",
    status: "active",
    createdDays: 5,
  },
  {
    email: "zoe.taylor@gmail.com",
    name: "Zoe Taylor",
    company: null,
    plan: "free",
    status: "active",
    createdDays: 3,
  },
  {
    email: "omar@souqwatch.eg",
    name: "Omar Farouk",
    company: "SouqWatch",
    plan: "starter",
    status: "trialing",
    createdDays: 2,
  },
  {
    email: "hannah@dealradar.at",
    name: "Hannah Müller",
    company: "DealRadar",
    plan: "free",
    status: "trialing",
    createdDays: 1,
  },
  {
    email: "liam.obrien@gmail.com",
    name: "Liam O'Brien",
    company: null,
    plan: "free",
    status: "trialing",
    createdDays: 0,
  },
];

// Generated customers give the demo realistic volume + a growth curve. The 24
// named accounts above are the most recent (top of the list); these fill in
// older history so signups, revenue, and the customer count read like a real
// SaaS. Deterministic — same output on every reseed.
const FIRST_NAMES = [
  "Ava",
  "Noah",
  "Mia",
  "Leo",
  "Ella",
  "Hugo",
  "Nora",
  "Max",
  "Lena",
  "Jonas",
  "Clara",
  "Ivan",
  "Sara",
  "Niklas",
  "Maya",
  "Ben",
  "Lea",
  "Finn",
  "Elin",
  "Adam",
  "Yuki",
  "Said",
  "Noor",
  "Kai",
  "Theo",
  "Iris",
  "Dana",
  "Vera",
  "Pablo",
  "Ines",
  "Reza",
  "Tara",
  "Jan",
  "Lila",
  "Arto",
  "Suvi",
];
const LAST_NAMES = [
  "Andersson",
  "Berg",
  "Cohen",
  "Diaz",
  "Eriksen",
  "Fischer",
  "Garcia",
  "Haas",
  "Ibrahim",
  "Jensen",
  "Kovac",
  "Lindholm",
  "Meyer",
  "Nilsson",
  "Olsen",
  "Petrov",
  "Rossi",
  "Schmidt",
  "Tan",
  "Ueda",
  "Vogel",
  "Wang",
  "Yilmaz",
  "Zhang",
  "Novak",
  "Horvath",
  "Dubois",
  "Costa",
  "Marin",
  "Bauer",
];
const GEN_COMPANIES: (string | null)[] = [
  "Pricewise",
  "Stocksy",
  "Cartlytics",
  "Scrapely",
  "Vendly",
  "Crawlr",
  "Pulsefeed",
  "Marketly",
  "Shelfwise",
  "Bargainly",
  "Catalog",
  "Feedbase",
  "Retailr",
  "Pricepulse",
  "Scoutly",
  "Gridly",
  "Trendwatch",
  "Stockpeek",
  null,
  null,
  null,
];
const FREE_DOMAINS = ["gmail.com", "outlook.com", "proton.me", "icloud.com"];

function generatedCustomers(count: number): typeof USERS {
  const out: typeof USERS = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[(i * 7) % FIRST_NAMES.length] ?? "Alex";
    const last = LAST_NAMES[(i * 13) % LAST_NAMES.length] ?? "Kim";
    const company = GEN_COMPANIES[(i * 5) % GEN_COMPANIES.length] ?? null;
    const domain = company
      ? `${company.toLowerCase().replace(/[^a-z]/g, "")}.com`
      : (FREE_DOMAINS[i % FREE_DOMAINS.length] ?? "gmail.com");
    const localPart = `${first}.${last}${i}`.toLowerCase().replace(/[^a-z.0-9]/g, "");
    const email = `${localPart}@${domain}`;
    // Growth curve: recent dates are denser (accelerating signups).
    const createdDays = Math.round(8 + 160 * (i / Math.max(1, count - 1)) ** 1.8);
    const r = (i * 37) % 100;
    let plan: Plan = "free";
    if (r >= 88) plan = "business";
    else if (r >= 70) plan = "pro";
    else if (r >= 45) plan = "starter";
    let status: Account = plan === "free" && i % 3 === 0 ? "trialing" : "active";
    if ((i * 11) % 19 === 0) status = "past_due";
    if ((i * 17) % 29 === 0) status = "canceled";
    out.push({ email, name: `${first} ${last}`, company, plan, status, createdDays });
  }
  return out;
}

/** Named marquee accounts + generated history → realistic volume. */
const CUSTOMERS = [...USERS, ...generatedCustomers(66)];

/** Scrapers: [userIdx, name, targetUrl, schedule, status, lastRunHoursAgo]. */
const SCRAPERS: [number, string, string, Schedule, Scraper, number][] = [
  [
    0,
    "Amazon BSR — Electronics",
    "https://www.amazon.com/gp/bestsellers/electronics",
    "daily",
    "active",
    4,
  ],
  [
    0,
    "Best Buy — GPU stock",
    "https://www.bestbuy.com/site/computer-cards-components",
    "hourly",
    "active",
    1,
  ],
  [0, "Newegg — daily deals", "https://www.newegg.com/todays-deals", "hourly", "active", 2],
  [1, "Product Hunt — daily", "https://www.producthunt.com", "daily", "active", 7],
  [1, "G2 — CRM reviews", "https://www.g2.com/categories/crm", "weekly", "active", 30],
  [2, "Heureka.cz — prices", "https://www.heureka.cz", "daily", "active", 9],
  [2, "Alza.cz — electronics", "https://www.alza.cz/elektro", "daily", "paused", 220],
  [3, "Etsy — handmade jewelry", "https://www.etsy.com/c/jewelry", "daily", "active", 12],
  [4, "Idealo.de — price index", "https://www.idealo.de", "hourly", "active", 1],
  [4, "MediaMarkt — stock", "https://www.mediamarkt.de", "daily", "active", 5],
  [4, "Otto.de — catalog", "https://www.otto.de", "weekly", "error", 3],
  [5, "Zalando — new arrivals", "https://www.zalando.com/new", "daily", "active", 8],
  [5, "ASOS — sale", "https://www.asos.com/sale", "daily", "active", 14],
  [
    6,
    "Indeed — remote SWE",
    "https://www.indeed.com/q-remote-software-engineer",
    "daily",
    "active",
    10,
  ],
  [7, "Hacker News — front page", "https://news.ycombinator.com", "hourly", "active", 1],
  [8, "Kakaku.com — prices", "https://kakaku.com", "daily", "active", 11],
  [8, "Rakuten — deals", "https://www.rakuten.co.jp", "daily", "active", 18],
  [9, "Zillow — Austin TX", "https://www.zillow.com/austin-tx", "daily", "active", 6],
  [9, "Redfin — Seattle", "https://www.redfin.com/city/16163/WA/Seattle", "daily", "active", 9],
  [
    9,
    "Realtor.com — Denver",
    "https://www.realtor.com/realestateandhomes-search/Denver_CO",
    "weekly",
    "paused",
    300,
  ],
  [10, "Amazon.ae — offers", "https://www.amazon.ae/deals", "daily", "active", 13],
  [11, "Reddit — buildapcsales", "https://www.reddit.com/r/buildapcsales", "hourly", "active", 2],
  [12, "Mercado Livre — prices", "https://www.mercadolivre.com.br", "daily", "active", 7],
  [12, "Buscapé — comparador", "https://www.buscape.com.br", "daily", "active", 20],
  [13, "Taobao — trends", "https://www.taobao.com", "daily", "active", 5],
  [13, "JD.com — flash sales", "https://www.jd.com", "hourly", "active", 1],
  [14, "Vinted — listings", "https://www.vinted.com", "daily", "paused", 360],
  [15, "Flipkart — deals", "https://www.flipkart.com/offers-store", "daily", "active", 15],
  [16, "Jumia — phones", "https://www.jumia.co.ke/smartphones", "daily", "active", 16],
  [17, "Blocket — listings", "https://www.blocket.se", "daily", "active", 8],
  [17, "Prisjakt — prices", "https://www.prisjakt.nu", "daily", "active", 19],
  [18, "Subito.it — listings", "https://www.subito.it", "daily", "active", 22],
  [19, "Heureka — deals", "https://www.heureka.cz/exclusive", "daily", "active", 6],
  [
    20,
    "Craigslist — SF bikes",
    "https://sfbay.craigslist.org/d/bicycles/search/bia",
    "daily",
    "active",
    17,
  ],
  [21, "OLX Egypt", "https://www.olx.com.eg", "daily", "active", 21],
  [22, "Willhaben.at", "https://www.willhaben.at", "daily", "active", 26],
  [23, "DoneDeal.ie", "https://www.donedeal.ie", "daily", "active", 30],
];

const RECENT_SCRAPER_TARGETS: [string, string, Schedule][] = [
  ["Google Shopping — price index", "https://shopping.google.com", "daily"],
  ["Temu — flash deals", "https://www.temu.com", "hourly"],
  ["Shein — new arrivals", "https://www.shein.com", "daily"],
];

/** Guarantees the 10 most-recent joiners each get ≥1 scraper, even outside the hand-picked list. */
function withRecentCoverage(
  customers: typeof CUSTOMERS,
  scrapers: typeof SCRAPERS,
): typeof SCRAPERS {
  const owners = new Set(scrapers.map(([u]) => u));
  const recent = customers
    .map((u, i) => ({ i, createdDays: u.createdDays }))
    .sort((a, b) => a.createdDays - b.createdDays)
    .slice(0, 10)
    .map((x) => x.i)
    .filter((i) => !owners.has(i));
  const extra: typeof SCRAPERS = recent.map((i, k) => {
    const [name, url, schedule] = cycle(RECENT_SCRAPER_TARGETS, k);
    return [i, name, url, schedule, "active", 1 + (k % 4)];
  });
  return [...scrapers, ...extra];
}

/** SCRAPERS plus synthesized coverage for otherwise-scraperless recent joiners. */
const ALL_SCRAPERS = withRecentCoverage(CUSTOMERS, SCRAPERS);

const RUN_ERRORS = [
  "HTTP 429 Too Many Requests",
  "Selector .price not found",
  "Navigation timeout after 30000ms",
  "Blocked by Cloudflare challenge",
  "HTTP 503 Service Unavailable",
];

/** Only `maxRunning` runs total are seeded "running" — without a real worker
 *  behind Redis, a "running" run never finishes, so the count must stay tiny. */
const MAX_RUNNING = 2;
function makeRunStateFor(maxRunning: number) {
  let running = 0;
  return (seq: number, scraperStatus: string): RunState => {
    if (scraperStatus === "error" && seq % 2 === 0) return "failed";
    const r = seq % 10;
    if (r === 0) return "failed";
    if (r === 1) {
      if (running >= maxRunning) return "success";
      running++;
      return "running";
    }
    if (r === 2) return "queued";
    return "success";
  };
}

const AI_CALLS: {
  provider: Provider;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
}[] = [
  { provider: "openai", model: "gpt-5", tokensIn: 4200, tokensOut: 1100, costCents: 38 },
  { provider: "openai", model: "gpt-5-mini", tokensIn: 8800, tokensOut: 2400, costCents: 9 },
  {
    provider: "anthropic",
    model: "claude-opus-4-5",
    tokensIn: 5200,
    tokensOut: 1600,
    costCents: 31,
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    tokensIn: 9100,
    tokensOut: 2600,
    costCents: 7,
  },
  { provider: "google", model: "gemini-2.5-pro", tokensIn: 6100, tokensOut: 1800, costCents: 22 },
  { provider: "google", model: "gemini-2.5-flash", tokensIn: 12000, tokensOut: 3000, costCents: 4 },
];

const PLAN_PRICE: Record<Plan, number> = { free: 0, starter: 1900, pro: 4900, business: 9900 };

/** Wipe + reseed the demo database. Idempotent and re-runnable. */
export async function seedDatabase(db: Db): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE ${schema.matches}, ${schema.listings}, ${schema.products}, ${schema.aiUsage}, ${schema.runs}, ${schema.invoices}, ${schema.scrapers}, ${schema.users} RESTART IDENTITY CASCADE`,
  );

  // --- Customers ---
  const userRows = await db
    .insert(schema.users)
    .values(
      CUSTOMERS.map((u, i) => ({
        email: u.email,
        name: u.name,
        company: u.company,
        plan: u.plan,
        status: u.status,
        createdAt: stampDays(u.createdDays, i),
        lastSeenAt: u.status === "active" ? hours((u.createdDays % 12) + 1) : null,
      })),
    )
    .returning({ id: schema.users.id });
  const uid = (i: number): number => {
    const id = userRows[i]?.id;
    if (id === undefined) throw new Error(`seed: missing user #${i}`);
    return id;
  };

  // --- Scrapers ---
  const scraperRows = await db
    .insert(schema.scrapers)
    .values(
      ALL_SCRAPERS.map(([u, name, url, schedule, status, lastRunH]) => ({
        userId: uid(u),
        name,
        targetUrl: url,
        schedule,
        status,
        createdAt: days(CUSTOMERS[u]?.createdDays ?? 30),
        lastRunAt: hours(lastRunH),
      })),
    )
    .returning({ id: schema.scrapers.id });
  const sid = (i: number): number => {
    const id = scraperRows[i]?.id;
    if (id === undefined) throw new Error(`seed: missing scraper #${i}`);
    return id;
  };

  // --- Runs (2–3 per scraper, deterministic spread over the last 14 days) ---
  const runValues: (typeof schema.runs.$inferInsert)[] = [];
  const runOwner: number[] = []; // parallel: user index that owns each run
  const runStateFor = makeRunStateFor(MAX_RUNNING);
  ALL_SCRAPERS.forEach(([u, , , , status], i) => {
    const count = cycle([3, 4, 2, 3], i);
    for (let k = 0; k < count; k++) {
      const seq = i * 7 + k;
      const state = runStateFor(seq, status);
      const live = state === "running" || state === "queued";
      // Finished runs spread across the whole window; "running" has no worker
      // without Redis, so it must look freshly started, not stuck for hours.
      const startedAt =
        state === "running"
          ? minutes(1 + (seq % 5))
          : live
            ? hours((seq * 7) % 20)
            : spreadAt(runValues.length);
      const pages =
        state === "success"
          ? 20 + ((seq * 13) % 180)
          : state === "failed"
            ? (seq * 3) % 9
            : state === "running"
              ? (seq * 5) % 40
              : 0;
      const items = state === "success" ? pages * (3 + (seq % 8)) : 0;
      const durationMs =
        state === "success"
          ? 2000 + ((seq * 137) % 118000)
          : state === "failed"
            ? 500 + ((seq * 97) % 7500)
            : null;
      runValues.push({
        scraperId: sid(i),
        status: state,
        pagesCrawled: pages,
        itemsExtracted: items,
        durationMs,
        startedAt,
        finishedAt: live || durationMs == null ? null : new Date(startedAt.getTime() + durationMs),
        error: state === "failed" ? cycle(RUN_ERRORS, seq) : null,
      });
      runOwner.push(u);
    }
  });
  const runRows = await db.insert(schema.runs).values(runValues).returning({ id: schema.runs.id });

  // run id → its startedAt, so listings + AI usage share a consistent timeline.
  const runStartById = new Map<number, Date>();
  runRows.forEach((row, j) => {
    const sa = runValues[j]?.startedAt;
    if (row?.id !== undefined && sa instanceof Date) runStartById.set(row.id, sa);
  });

  // --- Catalog: the customer's own SKUs (what they want matched) ---
  // Each CATALOG entry becomes a catalog product owned by a customer, priced
  // near the market price. These are the anchors the AI matches listings to.
  const productValues: (typeof schema.products.$inferInsert)[] = CATALOG.map((p, i) => ({
    userId: uid(i % CUSTOMERS.length),
    sku: `SKU-${1000 + i}`,
    title: p.title,
    brand: p.brand,
    category: p.category,
    ourPriceCents: Math.round(p.priceCents * (0.92 + (i % 17) / 100)),
    createdAt: stampDays((i * 3) % 120, i),
  }));
  const productRows = await db
    .insert(schema.products)
    .values(productValues)
    .returning({ id: schema.products.id });

  // --- Listings: competitor offers across marketplaces, found by runs. ---
  // Each catalog product is found on 2–4 sites; price spreads around market.
  // Listings tie to the product's source scraper (by name) + a success run.
  const scraperIdByName = new Map<string, number>();
  ALL_SCRAPERS.forEach(([, name], i) => {
    scraperIdByName.set(name, sid(i));
  });
  const successRunByScraper = new Map<number, number>();
  runValues.forEach((rv, j) => {
    const runId = runRows[j]?.id;
    if (rv.status === "success" && runId !== undefined && !successRunByScraper.has(rv.scraperId)) {
      successRunByScraper.set(rv.scraperId, runId);
    }
  });

  const listingValues: (typeof schema.listings.$inferInsert)[] = [];
  const listingProductIdx: number[] = []; // parallel: catalog product index per listing
  CATALOG.forEach((p, i) => {
    const scraperId = scraperIdByName.get(p.scraper);
    if (scraperId === undefined) throw new Error(`seed: unknown scraper "${p.scraper}"`);
    const n = 2 + (i % 3); // 2..4 competitor listings per product
    const runId = successRunByScraper.get(scraperId) ?? null;
    const runStart = runId != null ? runStartById.get(runId) : undefined;
    for (let k = 0; k < n; k++) {
      const site = SITES[(i + k) % SITES.length] ?? "amazon";
      const spread = 0.85 + ((i + k) % 30) / 100; // ~0.85..1.15 of market price
      // Scraped when its run ran (so listing/run timelines agree); otherwise
      // spread across the window.
      const scrapedAt = runStart
        ? new Date(Math.min(Date.now() - HOUR, runStart.getTime() + ((i + k) % 6) * HOUR))
        : spreadAt(listingValues.length);
      listingValues.push({
        scraperId,
        runId,
        asin: `B0${10000 + i * 5 + k}`,
        site,
        title: p.title,
        brand: p.brand,
        category: p.category,
        priceCents: Math.round(p.priceCents * spread),
        currency: "USD",
        seller: SELLERS[(i + k) % SELLERS.length] ?? null,
        rating: p.rating,
        reviews: Math.round(p.reviews * (0.6 + ((i + k) % 8) / 10)),
        stock: cycle(["in_stock", "in_stock", "low_stock", "out_of_stock"] as const, i + k),
        url: `https://${site}.com/dp/B0${10000 + i}`,
        scrapedAt,
      });
      listingProductIdx.push(i);
    }
  });
  const listingRows = await db
    .insert(schema.listings)
    .values(listingValues)
    .returning({ id: schema.listings.id });

  // --- Matches: the AI link from a listing to a catalog product, with a
  //     confidence score. Distribution ≈ 70% confirmed / 18% needs_review /
  //     12% rejected, tagged by model. needs_review rows wait for a human. ---
  const REVIEWERS = ["amelia.r", "ops-bot", "devon.k", null] as const;
  const matchValues: (typeof schema.matches.$inferInsert)[] = [];
  listingRows.forEach((listing, li) => {
    const pIdx = listingProductIdx[li] ?? 0;
    const productId = productRows[pIdx]?.id;
    if (productId === undefined) return;
    // Matched shortly after the listing was scraped.
    const scrapedAt = listingValues[li]?.scrapedAt;
    const matchedAt = new Date(
      Math.min(
        Date.now() - 30 * 60_000,
        (scrapedAt instanceof Date ? scrapedAt.getTime() : Date.now()) + (2 + (li % 6)) * HOUR,
      ),
    );
    const ageDays = (Date.now() - matchedAt.getTime()) / DAY;
    // Confidence band: ~70% high, ~18% mid, ~12% low.
    const r = (li * 37) % 100;
    let conf: number;
    if (r < 70)
      conf = 0.86 + ((li * 13) % 14) / 100; // 0.86..0.99
    else if (r < 88)
      conf = 0.55 + ((li * 17) % 30) / 100; // 0.55..0.84
    else conf = 0.3 + ((li * 11) % 25) / 100; // 0.30..0.54
    // High confidence auto-confirms, low auto-rejects. Mid-confidence sits in
    // the review queue only while it's recent — older mid matches have since
    // been resolved by an analyst. This makes the "Match status" donut shift as
    // you widen the date range (recent = more needs_review).
    let status: Match;
    if (conf >= 0.85) status = "confirmed";
    else if (conf < 0.55) status = "rejected";
    else status = ageDays <= 12 ? "needs_review" : li % 2 === 0 ? "confirmed" : "rejected";
    const reviewed = status !== "needs_review";
    matchValues.push({
      listingId: listing.id,
      productId,
      confidence: Number(conf.toFixed(2)),
      status,
      model: cycle(MATCH_MODELS, li),
      matchedAt,
      reviewedAt: reviewed ? new Date(matchedAt.getTime() + (4 + (li % 8)) * HOUR) : null,
      reviewedBy: reviewed ? (REVIEWERS[li % REVIEWERS.length] ?? null) : null,
    });
  });
  await db.insert(schema.matches).values(matchValues);

  // --- Invoices: monthly billing per paying customer, anchored to a per-
  //     customer billing day so payments spread across the month instead of
  //     all landing on one date. That makes "collected (last 7 days)" a
  //     believable rolling number. ---
  const invoiceValues: (typeof schema.invoices.$inferInsert)[] = [];
  CUSTOMERS.forEach((u, i) => {
    if (u.plan === "free") return;
    const amount = PLAN_PRICE[u.plan];
    // Days since last bill, capped to tenure so no paying customer ends up with 0 invoices.
    const cycleOffset = Math.min(i % 30, Math.max(0, u.createdDays - 1));
    const maxCycles = Math.min(4, Math.floor(u.createdDays / 30) + 1);
    for (let m = 0; m < maxCycles; m++) {
      const ageDays = cycleOffset + m * 30;
      if (ageDays > u.createdDays + 3) break; // no invoices before they signed up
      let status: Invoice = "paid";
      let paidAt: Date | null = stampDays(Math.max(0, ageDays - 1), i * 5 + m);
      let stripeId: string | null = `ch_3${(1000 + i * 7 + m).toString(36)}Kq9`;
      if (m === 0 && u.status === "past_due") {
        status = "open"; // overdue current invoice
        paidAt = null;
        stripeId = null;
      } else if (m === 0 && u.status === "canceled") {
        status = "void";
        paidAt = null;
        stripeId = null;
      } else if (m === 0 && cycleOffset <= 2) {
        status = "open"; // just billed — within the grace window, not yet paid
        paidAt = null;
        stripeId = null;
      } else if ((i * 13) % 23 === 0 && m === 1) {
        status = "refunded"; // a few refunds, keep paidAt + stripeId
      }
      invoiceValues.push({
        userId: uid(i),
        amountCents: amount,
        status,
        stripeId,
        periodStart: stampDays(ageDays, i * 3 + m),
        periodEnd: days(ageDays - 30),
        paidAt,
        createdAt: stampDays(ageDays, i * 3 + m + 1),
      });
    }
  });
  await db.insert(schema.invoices).values(invoiceValues);

  // --- AI usage (LLM extraction metering, tied to every other run) ---
  const aiValues: (typeof schema.aiUsage.$inferInsert)[] = [];
  let callIdx = 0;
  runRows.forEach((run, j) => {
    if (j % 2 === 1) return; // roughly half the runs invoke the LLM extractor
    const call = cycle(AI_CALLS, callIdx++);
    const owner = runOwner[j];
    if (owner === undefined) throw new Error(`seed: missing run owner #${j}`);
    const scale = 1 + (j % 4) * 0.25;
    const ranAt = runValues[j]?.startedAt;
    aiValues.push({
      userId: uid(owner),
      runId: run.id,
      provider: call.provider,
      model: call.model,
      task: j % 5 < 2 ? "match" : "extract",
      tokensIn: Math.round(call.tokensIn * scale),
      tokensOut: Math.round(call.tokensOut * scale),
      costCents: Math.round(call.costCents * scale),
      createdAt: new Date((ranAt instanceof Date ? ranAt.getTime() : Date.now()) + 2 * HOUR),
    });
  });
  await db.insert(schema.aiUsage).values(aiValues);
}
