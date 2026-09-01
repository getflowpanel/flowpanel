import { custom, dashboard, metric, table } from "@flowpanel/kit";
import { LiveOperations } from "@/src/admin/LiveOperations";
import {
  activeMonitorCount,
  crawlSuccessRate,
  offersDiscovered,
  reviewBacklog,
  reviewQueueSummary,
} from "@/src/admin/overview-queries";
import { ReviewQueue } from "@/src/admin/ReviewQueue";
import { getLiveOperationsSnapshot } from "@/src/demo/realtime/feed";
import { liveQueues } from "@/src/lib/queues";

export const overview = dashboard({
  path: "/",
  label: "Overview",
  icon: "layout-dashboard",
  dateRange: { preset: "last7d" },
  sections: [
    {
      description:
        "Monitor customer catalogs, marketplace coverage, crawl health, and AI-assisted matching.",
      columns: 4,
      widgets: [
        metric("Active monitors", activeMonitorCount, {
          drilldown: "/admin/monitors",
          sublabel: "running now",
        }),
        metric("Offers discovered", offersDiscovered, {
          drilldown: "/admin/listings",
          sublabel: "in this period",
        }),
        metric("Crawl success", crawlSuccessRate, {
          drilldown: "/admin/runs",
          sublabel: "completed runs",
        }),
        metric("Needs review", reviewBacklog, {
          drilldown: "/admin/matches",
          sublabel: "AI matches",
          tone: "warn",
        }),
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
          {
            span: 12,
            frame: false,
          },
        ),
      ],
    },
    {
      columns: 12,
      widgets: [
        custom(ReviewQueue, reviewQueueSummary, {
          span: 4,
          frame: false,
        }),
        table({
          label: "Recent runs",
          resource: "runs",
          columns: ["status", "pagesCrawled", "itemsExtracted", "durationMs", "startedAt"],
          limit: 5,
          span: 8,
        }),
      ],
    },
  ],
});
