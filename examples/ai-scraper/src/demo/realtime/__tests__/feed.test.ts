import { describe, expect, it } from "vitest";
import { createMarketEvent } from "../feed";

describe("market activity", () => {
  it("emits a bounded event from the canonical product stories", () => {
    const event = createMarketEvent(7, new Date("2026-08-24T12:00:00.000Z"));
    expect(event.title.length).toBeGreaterThan(5);
    expect(["price_drop", "price_rise", "stock_change", "crawl_completed"]).toContain(event.kind);
    expect(event.at.toISOString()).toBe("2026-08-24T12:00:00.000Z");
    expect(event.marketplace).toMatch(/amazon|best buy|ebay|walmart|mercado libre|media markt/i);
  });
});
