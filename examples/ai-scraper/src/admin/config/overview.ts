import { custom, dashboard, metric, table } from "@flowpanel/kit";
import { areaChart, pieChart } from "@flowpanel/kit/charts";
import { MarketActivity } from "@/src/admin/MarketActivity";
import {
  activeMonitorCount,
  crawlSuccessRate,
  matchQuality,
  offersDiscovered,
  offersTrend,
  reviewBacklog,
} from "@/src/admin/overview-queries";
import { getMarketActivitySnapshot } from "@/src/demo/realtime/feed";

export const overview = dashboard({
  path: "/",
  label: "Overview",
  icon: "layout-dashboard",
  dateRange: { preset: "last7d" },
  sections: [
    {
      label: "Operations",
      description:
        "Monitor customer catalogs, marketplace coverage, crawl health, and AI-assisted matching.",
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
        custom(MarketActivity, async () => ({ initial: getMarketActivitySnapshot() }), {
          span: 4,
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
          colors: {
            confirmed: "hsl(158 42% 48%)",
            needs_review: "hsl(40 68% 56%)",
            rejected: "hsl(353 50% 61%)",
          },
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
