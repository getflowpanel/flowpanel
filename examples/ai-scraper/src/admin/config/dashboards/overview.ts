import {
  bars,
  custom,
  dashboard,
  funnel,
  list,
  metric,
  type RowOf,
  stat,
  type Threshold,
  table,
} from "@flowpanel/kit";
import { LiveOperations } from "@/src/admin/LiveOperations";
import {
  aiSpend,
  crawlSuccess,
  failingCrawls,
  listingsByMarketplace,
  matchPipeline,
  reviewQueue,
} from "@/src/admin/overview-queries";
import { ReviewQueue } from "@/src/admin/ReviewQueue";
import { getLiveOperationsSnapshot } from "@/src/demo/realtime/feed";

const HEALTHY_CRAWLS: Threshold = { warn: 0.9, err: 0.8, min: 10 };

export const overview = dashboard({
  path: "/",
  label: "Overview",
  icon: "layout-dashboard",
  dateRange: { preset: "last7d" },
  refresh: "60s",
  sections: [
    {
      columns: 4,
      widgets: [
        metric(
          "Active monitors",
          { count: "monitors", where: { status: "active" } },
          { sublabel: "on schedule" },
        ),
        metric("Listings found", { count: "listings", range: "scrapedAt" }, { compare: true }),
        metric("Crawl success", crawlSuccess, {
          format: "percent",
          compare: true,
          tones: HEALTHY_CRAWLS,
          sublabel: "finished runs",
          drilldown: {
            resource: "runs",
            filter: { status: ["success", "failed"] },
            range: "startedAt",
          },
        }),
        metric(
          "Needs review",
          { count: "matches", where: { status: "needs_review" } },
          { sublabel: "AI matches", goodWhen: "down" },
        ),
      ],
    },
    {
      columns: 12,
      widgets: [
        custom(
          LiveOperations,
          async (c) => ({
            initial: getLiveOperationsSnapshot(),
            running: await c.count("runs", { status: "running" }),
            tracked: await c.count("listings"),
          }),
          { span: 12, frame: false, label: "Live operations" },
        ),
      ],
    },
    {
      columns: 12,
      widgets: [
        custom(ReviewQueue, reviewQueue, { span: 4, frame: false, label: "Review queue" }),
        table<RowOf<"runs">>({
          label: "Recent runs",
          resource: "runs",
          columns: ["status", "pagesCrawled", "itemsExtracted", "durationMs", "startedAt"],
          rowHref: (row) => ({ resource: "runs", id: row.id }),
          seeAll: true,
          limit: 5,
          span: 8,
        }),
      ],
    },
    {
      label: "Where the listings come from",
      columns: 12,
      widgets: [
        bars({
          label: "Top marketplaces",
          query: listingsByMarketplace,
          share: true,
          compare: true,
          emptyState: "No listings were found in this period.",
          span: 4,
        }),
        funnel({
          label: "Matching pipeline",
          query: matchPipeline,
          emptyState: "Nothing has been matched in this period.",
          span: 4,
        }),
        list({
          label: "Failing crawls",
          query: failingCrawls,
          emptyState: "Every crawl succeeded.",
          span: 4,
        }),
      ],
    },
    {
      label: "Account health",
      columns: 4,
      widgets: [
        metric(
          "Paying accounts",
          { count: "customers", where: { status: "active" } },
          { sublabel: "active subscriptions" },
        ),
        metric("Products tracked", { count: "products" }, { sublabel: "customer catalogs" }),
        metric(
          "Failed runs",
          { count: "runs", where: { status: "failed" } },
          { sublabel: "all time", goodWhen: "down" },
        ),
        stat("AI spend", aiSpend, { format: "currency", hint: "in this period" }),
      ],
    },
  ],
});
