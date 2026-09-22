import { bars, custom, dashboard, funnel, list, metric, stat, table } from "@flowpanel/kit";
import { LiveOperations } from "@/src/admin/LiveOperations";
import {
  aiSpendDollars,
  failingCrawls,
  matchPipeline,
  offersByMarketplace,
} from "@/src/admin/overview-breakdowns";
import {
  activeMonitorCount,
  crawlSuccessRate,
  offersDiscovered,
  reviewBacklog,
  reviewQueueSummary,
} from "@/src/admin/overview-queries";
import { ReviewQueue } from "@/src/admin/ReviewQueue";
import type * as schema from "@/src/db/schema";
import { getLiveOperationsSnapshot } from "@/src/demo/realtime/feed";
import { liveQueues } from "@/src/lib/queues";

type Run = typeof schema.runs.$inferSelect;

export const overview = dashboard({
  path: "/",
  label: "Overview",
  icon: "layout-dashboard",
  dateRange: { preset: "last7d" },
  refresh: "60s",
  sections: [
    {
      description:
        "Monitor customer catalogs, marketplace coverage, crawl health, and AI-assisted matching.",
      columns: 4,
      widgets: [
        metric("Active monitors", activeMonitorCount, { sublabel: "running now" }),
        metric("Offers discovered", offersDiscovered, { sublabel: "in this period" }),
        metric("Crawl success", crawlSuccessRate, { sublabel: "completed runs" }),
        metric("Needs review", reviewBacklog, { sublabel: "AI matches" }),
      ],
    },
    {
      columns: 12,
      widgets: [
        custom(
          LiveOperations,
          async () => ({
            initial: getLiveOperationsSnapshot(),
            ...(liveQueues[0] ? { queueHref: `/admin/queues/${liveQueues[0].name}` } : {}),
          }),
          { span: 12, frame: false },
        ),
      ],
    },
    {
      columns: 12,
      widgets: [
        custom(ReviewQueue, reviewQueueSummary, { span: 4, frame: false }),
        table<Run>({
          label: "Recent runs",
          resource: "runs",
          columns: ["status", "pagesCrawled", "itemsExtracted", "durationMs", "startedAt"],
          rowHref: (row, ctx) => ctx.href("runs", row.id),
          seeAll: true,
          limit: 5,
          span: 8,
        }),
      ],
    },
    {
      label: "Where the offers come from",
      columns: 12,
      widgets: [
        bars({
          label: "Top marketplaces",
          query: offersByMarketplace,
          emptyState: "No offers were discovered in this period.",
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
        stat("Paying accounts", (ctx) => ctx.count("customers", { status: "active" }), {
          hint: "status: active",
        }),
        stat("Products tracked", (ctx) => ctx.count("products"), { hint: "customer catalogs" }),
        stat("Failed runs", (ctx) => ctx.count("runs", { status: "failed" }), { hint: "all time" }),
        stat("AI spend", aiSpendDollars, { format: "currency", hint: "in this period" }),
      ],
    },
  ],
});
