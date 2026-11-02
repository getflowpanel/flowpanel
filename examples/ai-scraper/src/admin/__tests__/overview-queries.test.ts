import { widgetContext } from "@flowpanel/kit/test/widgets";
import { describe, expect, it } from "vitest";
import type { AdminSession } from "@/src/demo/auth/session";
import { crawlSuccess, listingsByMarketplace } from "../overview-queries";

const session: AdminSession = {
  id: 1,
  email: "dev@localhost",
  role: "admin",
  sandboxId: "local",
  user: { id: "alex.admin", name: "Alex Admin" },
};

describe("crawlSuccess", () => {
  it("is the share of finished runs that succeeded, ignoring queued and running ones", async () => {
    const ctx = widgetContext({
      rows: {
        runs: [
          { status: "success", startedAt: new Date() },
          { status: "success", startedAt: new Date() },
          { status: "success", startedAt: new Date() },
          { status: "failed", startedAt: new Date() },
          { status: "running", startedAt: new Date() },
        ],
      },
    });

    expect(await crawlSuccess(ctx)).toEqual({ value: 0.75, volume: 4 });
  });

  it("shows a dash when nothing finished", async () => {
    const ctx = widgetContext({ rows: { runs: [{ status: "queued", startedAt: new Date() }] } });

    expect(await crawlSuccess(ctx)).toEqual({ value: "—", volume: 0 });
  });
});

describe("listingsByMarketplace", () => {
  it("ranks marketplaces by name and links each bar to its listings", async () => {
    const ctx = widgetContext({
      session,
      sql: [{ site: "best_buy" }, { site: "best_buy" }, { site: "amazon" }],
    });

    const bars = await listingsByMarketplace(ctx);

    expect(bars.map((bar) => [bar.label, bar.value])).toEqual([
      ["Best Buy", 2],
      ["Amazon", 1],
    ]);
    expect(bars[0]?.href).toEqual({
      resource: "listings",
      filter: { site: "best_buy" },
      range: "scrapedAt",
    });
  });
});
