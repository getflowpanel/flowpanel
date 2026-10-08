import {
  type BarRow,
  breakdown,
  type FunnelStep,
  type ListRow,
  type MetricResult,
  type StatValue,
  type WidgetContext,
} from "@flowpanel/kit";
import { Site } from "@/src/admin/config/enums";
import type { ReviewQueueProps } from "@/src/admin/ReviewQueue";
import { requireSandboxId } from "@/src/demo/sandbox/scope";

const completedRuns = { status: ["success", "failed"] } as const;

export async function crawlSuccess(c: WidgetContext): Promise<MetricResult> {
  const [completed, succeeded] = await Promise.all([
    c.count("runs", completedRuns, { range: "startedAt" }),
    c.count("runs", { status: "success" }, { range: "startedAt" }),
  ]);
  return { value: completed === 0 ? "—" : succeeded / completed, volume: completed };
}

const listingsFound = (c: WidgetContext) =>
  c.sql<{ site: string }>`
    select site from listings
    where sandbox_id = ${requireSandboxId(c.session)}
      and scraped_at >= ${c.dateRange.from} and scraped_at <= ${c.dateRange.to}`;

export async function listingsByMarketplace(c: WidgetContext): Promise<BarRow[]> {
  return breakdown(await c.query(listingsFound), {
    by: "site",
    labels: Site,
    top: 5,
    href: (site) => ({ resource: "listings", filter: { site }, range: "scrapedAt" }),
  });
}

export async function matchPipeline(c: WidgetContext): Promise<FunnelStep[]> {
  const [found, matched, confirmed] = await Promise.all([
    c.count("listings", {}, { range: "scrapedAt" }),
    c.count("matches", {}, { range: "matchedAt" }),
    c.count("matches", { status: "confirmed" }, { range: "matchedAt" }),
  ]);
  return [
    { label: "Listings found", value: found, href: { resource: "listings", range: "scrapedAt" } },
    { label: "AI matched", value: matched, href: { resource: "matches", range: "matchedAt" } },
    {
      label: "Confirmed",
      value: confirmed,
      href: { resource: "matches", filter: { status: "confirmed" }, range: "matchedAt" },
    },
  ];
}

export async function failingCrawls(c: WidgetContext): Promise<ListRow[]> {
  const failed = await c.read("runs", {
    where: { status: "failed" },
    sort: { field: "startedAt", dir: "desc" },
    limit: 5,
    fields: ["error"],
  });
  if (failed.length === 0) return [];
  const monitors = await c.read("monitors", { where: { id: failed.map((run) => run.monitorId) } });
  const nameOf = new Map(monitors.map((monitor) => [monitor.id, monitor.name]));
  return failed.map((run) => ({
    text: nameOf.get(run.monitorId) ?? `Monitor #${run.monitorId}`,
    meta: run.error ?? "Unknown error",
    tone: "err",
    href: { resource: "runs", id: run.id },
  }));
}

export async function reviewQueue(c: WidgetContext): Promise<ReviewQueueProps> {
  const inRange = { range: "matchedAt" } as const;
  const [pending, confirmed, waiting, rejected] = await Promise.all([
    c.count("matches", { status: "needs_review" }),
    c.count("matches", { status: "confirmed" }, inRange),
    c.count("matches", { status: "needs_review" }, inRange),
    c.count("matches", { status: "rejected" }, inRange),
  ]);
  const total = confirmed + waiting + rejected;
  const share = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100));
  return {
    pending,
    href: c.link({ resource: "matches", view: "Needs review" }),
    outcomes: [
      { label: "Confirmed", count: confirmed, share: share(confirmed), tone: "default" },
      { label: "Needs review", count: waiting, share: share(waiting), tone: "warn" },
      { label: "Rejected", count: rejected, share: share(rejected), tone: "default" },
    ],
  };
}

export async function aiSpend(c: WidgetContext): Promise<StatValue> {
  const [row] = await c.sql<{ cents: number }>`
    select coalesce(sum(cost_cents), 0)::int as cents
    from ai_usage
    where sandbox_id = ${requireSandboxId(c.session)}
      and created_at >= ${c.dateRange.from} and created_at <= ${c.dateRange.to}`;
  return Number(row?.cents ?? 0) / 100;
}
