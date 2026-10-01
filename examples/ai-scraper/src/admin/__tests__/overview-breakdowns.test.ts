import type { WidgetContext } from "@flowpanel/kit";
import { describe, expect, it } from "vitest";
import { offersByMarketplace } from "../overview-breakdowns";

const rows = [
  { site: "best_buy", count: 12 },
  { site: "amazon", count: 7 },
];

const chain = {
  from: () => chain,
  where: () => chain,
  groupBy: () => chain,
  orderBy: () => chain,
  limit: async () => rows,
};

const ctx = {
  session: { sandboxId: "local" },
  dateRange: {
    from: new Date("2026-08-01T00:00:00.000Z"),
    to: new Date("2026-08-08T00:00:00.000Z"),
  },
  db: { select: () => chain },
} as unknown as Parameters<typeof offersByMarketplace>[0] & WidgetContext;

describe("offersByMarketplace", () => {
  it("labels each bar with the marketplace name", async () => {
    const bars = await offersByMarketplace(ctx);

    expect(bars.map((bar) => bar.label)).toEqual(["Best Buy", "Amazon"]);
  });

  it("keeps the raw site key in the link filter", async () => {
    const bars = await offersByMarketplace(ctx);

    expect(bars[0]).toMatchObject({
      value: 12,
      href: { resource: "listings", filter: { site: "best_buy" } },
    });
  });
});
