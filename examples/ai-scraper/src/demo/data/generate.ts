import { MATCH_MODELS } from "../../lib/ai-models";
import { PRODUCT_STORIES, SCENARIOS } from "./scenarios";
import type { DemoData, Marketplace, ProductStory } from "./types";

const DAY = 86_400_000;
const MINUTE = 60_000;
const BACKGROUND_PREFIXES = ["Harbor", "Cedar", "Summit", "Pacific", "Baltic", "Union", "Stone"];
const BACKGROUND_SUFFIXES = ["Audio", "Gaming", "Mobile", "Home", "Outdoor", "Toys"];
const FIRST_NAMES = ["Maya", "Jonas", "Nora", "Theo", "Lena", "Ivan", "Sara"];
const LAST_NAMES = ["Chen", "Berg", "Patel", "Costa", "Novak", "Meyer"];
const SELLERS = ["Marketplace Direct", "Northstar Retail", "Verified Outlet", "Metro Deals"];
const SITE_HOST: Record<Marketplace, string> = {
  amazon: "amazon.com",
  best_buy: "bestbuy.com",
  ebay: "ebay.com",
  newegg: "newegg.com",
  walmart: "walmart.com",
  media_markt: "mediamarkt.com",
  mercado_libre: "mercadolibre.com",
};

const atDaysAgo = (now: Date, days: number, hour: number) =>
  new Date(now.getTime() - days * DAY - hour * 60 * MINUTE);

const titleCaseMarketplace = (marketplace: Marketplace) =>
  marketplace
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

export function generateDemoData({ now }: { now: Date }): DemoData {
  const customers: DemoData["customers"] = SCENARIOS.map((scenario, index) => ({
    id: index + 1,
    email: scenario.email,
    name: scenario.contactName,
    company: scenario.company,
    plan: scenario.plan,
    status: "active",
    createdAt: atDaysAgo(now, index + 1, 9),
    lastSeenAt: atDaysAgo(now, 0, index + 1),
    deletedAt: null,
  }));

  for (let index = 0; index < 42; index++) {
    const segment = index % SCENARIOS.length;
    const first = FIRST_NAMES[index % FIRST_NAMES.length] ?? "Alex";
    const last = LAST_NAMES[(index * 5) % LAST_NAMES.length] ?? "Kim";
    const company = `${BACKGROUND_PREFIXES[Math.floor(index / 6)]} ${BACKGROUND_SUFFIXES[segment]}`;
    const plan = (["starter", "pro", "business", "pro"] as const)[index % 4] ?? "starter";
    const status = index % 17 === 0 ? "past_due" : index % 11 === 0 ? "trialing" : "active";
    customers.push({
      id: customers.length + 1,
      email: `${first}.${last}.${index + 1}@${company.toLowerCase().replaceAll(" ", "")}.com`,
      name: `${first} ${last}`,
      company,
      plan,
      status,
      createdAt: atDaysAgo(now, 8 + index * 2, 8 + (index % 8)),
      lastSeenAt: status === "active" ? atDaysAgo(now, index % 5, index % 12) : null,
      deletedAt: null,
    });
  }

  const monitors: DemoData["monitors"] = [];
  for (let customerId = 1; customerId <= 18; customerId++) {
    const scenario = SCENARIOS[(customerId - 1) % SCENARIOS.length];
    if (!scenario) throw new Error(`Missing scenario for customer ${customerId}`);
    for (let marketIndex = 0; marketIndex < 2; marketIndex++) {
      const marketplace = scenario.marketplaces[marketIndex];
      if (!marketplace) throw new Error(`Missing marketplace for ${scenario.company}`);
      monitors.push({
        id: monitors.length + 1,
        customerId,
        name: `${titleCaseMarketplace(marketplace)} · ${scenario.segment}`,
        targetUrl: `https://${SITE_HOST[marketplace]}/search?q=${encodeURIComponent(scenario.segment)}`,
        schedule: marketIndex === 0 ? "hourly" : "daily",
        status: customerId % 11 === 0 && marketIndex === 1 ? "paused" : "active",
        createdAt: atDaysAgo(now, 35 + customerId, 8),
        lastRunAt: null,
      });
    }
  }

  const runs: DemoData["runs"] = [];
  for (const monitor of monitors) {
    for (let ordinal = 0; ordinal < 7; ordinal++) {
      const runIndex = runs.length;
      const status =
        ordinal === 0 && monitor.id % 9 === 0
          ? "running"
          : (monitor.id * 7 + ordinal) % 13 === 0
            ? "failed"
            : "success";
      const ageDays = (ordinal * 13 + Math.floor((monitor.id - 1) / 2) * 5) % 90;
      const startedAt =
        status === "running"
          ? new Date(now.getTime() - (2 + (monitor.id % 5)) * MINUTE)
          : atDaysAgo(now, ageDays, 7 + ((monitor.id + ordinal) % 11));
      const durationMs = status === "running" ? null : 28 * MINUTE + (runIndex % 25) * MINUTE;
      const pagesCrawled = status === "failed" ? 2 + (runIndex % 6) : 24 + (runIndex % 120);
      runs.push({
        id: runIndex + 1,
        monitorId: monitor.id,
        status,
        pagesCrawled,
        itemsExtracted: status === "success" ? pagesCrawled * (3 + (runIndex % 5)) : 0,
        durationMs,
        startedAt,
        finishedAt: durationMs == null ? null : new Date(startedAt.getTime() + durationMs),
        error:
          status === "failed"
            ? (["Marketplace returned 429", "Selector changed on product grid", "Upstream timeout"][
                runIndex % 3
              ] ?? "Upstream failure")
            : null,
      });
    }
    monitor.lastRunAt = runs
      .filter((run) => run.monitorId === monitor.id)
      .reduce<Date | null>(
        (latest, run) => (latest == null || run.startedAt > latest ? run.startedAt : latest),
        null,
      );
  }

  const products: DemoData["products"] = [];
  for (let scenarioIndex = 0; scenarioIndex < SCENARIOS.length; scenarioIndex++) {
    const scenario = SCENARIOS[scenarioIndex];
    if (!scenario) continue;
    for (const story of scenario.products) {
      products.push({
        id: products.length + 1,
        customerId: scenarioIndex + 1,
        sku: story.sku,
        title: story.title,
        brand: story.brand,
        category: story.category,
        ourPriceCents: story.ourPriceCents,
        createdAt: atDaysAgo(now, 3 + scenarioIndex, 10),
      });
    }
  }
  for (let index = 0; index < 42; index++) {
    const story = PRODUCT_STORIES[index % PRODUCT_STORIES.length];
    if (!story) throw new Error(`Missing product story ${index}`);
    const customerId = (index % 18) + 1;
    products.push({
      id: products.length + 1,
      customerId,
      sku: `${story.sku}-${String(index + 1).padStart(2, "0")}`,
      title: story.title,
      brand: story.brand,
      category: story.category,
      ourPriceCents: Math.round(story.ourPriceCents * (0.97 + (index % 7) / 100)),
      createdAt: atDaysAgo(now, 12 + (index % 55), 9 + (index % 6)),
    });
  }

  const listings: DemoData["listings"] = [];
  const matches: DemoData["matches"] = [];
  const storyForProduct = (product: DemoData["products"][number]): ProductStory => {
    const direct = PRODUCT_STORIES.find((story) => product.sku.startsWith(story.sku));
    if (!direct) throw new Error(`No story for ${product.sku}`);
    return direct;
  };

  for (const product of products) {
    const story = storyForProduct(product);
    const customerMonitors = monitors.filter(
      (monitor) => monitor.customerId === product.customerId,
    );
    for (let variantIndex = 0; variantIndex < story.variants.length; variantIndex++) {
      const variant = story.variants[variantIndex];
      const monitor = customerMonitors[variantIndex % customerMonitors.length];
      if (!variant || !monitor) throw new Error(`Incomplete listing story for ${product.sku}`);
      const run = runs
        .filter((candidate) => candidate.monitorId === monitor.id && candidate.status === "success")
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
      if (!run?.finishedAt) throw new Error(`No successful run for monitor ${monitor.id}`);
      const scrapedAt = new Date(run.startedAt.getTime() + (5 + variantIndex * 4) * MINUTE);
      const listingId = listings.length + 1;
      const marketplace = scenarioMarketplace(product.customerId, monitor.id);
      listings.push({
        id: listingId,
        monitorId: monitor.id,
        runId: run.id,
        asin: `OFFER-${String(listingId).padStart(6, "0")}`,
        site: marketplace,
        title: variant.title,
        brand: story.brand,
        category: story.category,
        priceCents: Math.round(story.ourPriceCents * variant.priceFactor),
        currency: "USD",
        seller: SELLERS[(listingId + variantIndex) % SELLERS.length] ?? "Marketplace Direct",
        rating: Number((3.8 + ((listingId * 7) % 12) / 10).toFixed(1)),
        reviews: 47 + ((listingId * 137) % 8400),
        stock:
          (["in_stock", "in_stock", "low_stock", "out_of_stock"] as const)[
            (listingId + variantIndex) % 4
          ] ?? "in_stock",
        url: `https://${SITE_HOST[marketplace]}/offer/${listingId}`,
        scrapedAt,
      });
      const matchedAt = new Date(scrapedAt.getTime() + (2 + (listingId % 6)) * MINUTE);
      const reviewed = variant.status !== "needs_review";
      matches.push({
        id: matches.length + 1,
        listingId,
        productId: product.id,
        confidence: variant.confidence,
        status: variant.status,
        model: MATCH_MODELS[listingId % MATCH_MODELS.length] ?? MATCH_MODELS[0],
        matchedAt,
        reviewedAt: reviewed ? new Date(matchedAt.getTime() + 4 * MINUTE) : null,
        reviewedBy: reviewed
          ? variant.status === "confirmed"
            ? "match-engine"
            : "maya.chen"
          : null,
      });
    }
  }

  const invoices: DemoData["invoices"] = [];
  const planPrice = { free: 0, starter: 1900, pro: 4900, business: 9900 } as const;
  for (const customer of customers) {
    if (customer.plan === "free") continue;
    for (let month = 0; month < 3; month++) {
      const createdAt = atDaysAgo(now, month * 30 + (customer.id % 19), 9);
      const status = month === 0 && customer.status === "past_due" ? "open" : "paid";
      invoices.push({
        id: invoices.length + 1,
        customerId: customer.id,
        amountCents: planPrice[customer.plan],
        status,
        stripeId: status === "paid" ? `ch_demo_${customer.id}_${month}` : null,
        periodStart: createdAt,
        periodEnd: new Date(createdAt.getTime() + 30 * DAY),
        paidAt: status === "paid" ? new Date(createdAt.getTime() + DAY) : null,
        createdAt,
      });
    }
  }

  const aiUsage: DemoData["aiUsage"] = runs.map((run, index) => ({
    id: index + 1,
    customerId: monitors.find((monitor) => monitor.id === run.monitorId)?.customerId ?? null,
    runId: run.id,
    provider: (["openai", "anthropic", "google"] as const)[index % 3] ?? "openai",
    model: MATCH_MODELS[index % MATCH_MODELS.length] ?? MATCH_MODELS[0],
    task: index % 3 === 0 ? "match" : "extract",
    tokensIn: 1800 + (index % 17) * 240,
    tokensOut: 420 + (index % 11) * 90,
    costCents: 2 + (index % 19),
    createdAt: new Date(run.startedAt.getTime() + 3 * MINUTE),
  }));

  return { customers, monitors, runs, products, listings, matches, invoices, aiUsage };
}

function scenarioMarketplace(customerId: number, monitorId: number): Marketplace {
  const scenario = SCENARIOS[(customerId - 1) % SCENARIOS.length];
  if (!scenario) throw new Error(`Missing scenario for customer ${customerId}`);
  return scenario.marketplaces[(monitorId - 1) % 2] ?? scenario.marketplaces[0] ?? "amazon";
}
