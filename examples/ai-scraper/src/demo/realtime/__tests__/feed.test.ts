import { describe, expect, it } from "vitest";
import { createMarketEvent, getLiveOperationsSnapshot } from "../feed";

describe("market activity", () => {
  it("emits a bounded event from the canonical product stories", () => {
    const event = createMarketEvent(7, new Date("2026-08-24T12:00:00.000Z"));
    expect(event.title.length).toBeGreaterThan(5);
    expect(["price_drop", "price_rise", "stock_change", "crawl_completed"]).toContain(event.kind);
    expect(event.at.toISOString()).toBe("2026-08-24T12:00:00.000Z");
    expect(event.marketplace).toMatch(/amazon|best buy|ebay|walmart|mercado libre|media markt/i);
  });

  it("provides a populated rolling series for the live throughput chart", () => {
    const snapshot = getLiveOperationsSnapshot();

    expect(snapshot.throughputHistory.length).toBeGreaterThanOrEqual(24);
    expect(snapshot.throughputHistory.length).toBeLessThanOrEqual(36);
    expect(snapshot.throughputHistory.at(-1)).toBe(snapshot.offersPerMinute);
    expect(snapshot.priceChangesToday).toBeGreaterThan(0);
    expect(snapshot.concurrentCrawls).toBeGreaterThan(0);
    expect(snapshot.avgMatchLatencyMs).toBeGreaterThan(0);

    const deltas = snapshot.throughputHistory.slice(1).map((value, index) => {
      return Math.abs(value - (snapshot.throughputHistory[index] ?? value));
    });
    expect(Math.max(...deltas)).toBeGreaterThanOrEqual(15);
  });

  it("upgrades an existing dev-server state when the snapshot shape changes", () => {
    const key = Symbol.for("scrapeai.marketActivity");
    const store = globalThis as typeof globalThis & { [key]?: unknown };
    const previous = store[key];
    store[key] = {
      timer: null,
      index: 5,
      offersPerMinute: 132,
      activeMonitors: 34,
      priceChangesToday: 250,
      concurrentCrawls: 4,
      avgMatchLatencyMs: 640,
      throughputHistory: Array.from({ length: 36 }, () => 132),
      events: [],
    };

    try {
      const snapshot = getLiveOperationsSnapshot();
      expect(snapshot.throughputHistory.length).toBeGreaterThanOrEqual(24);
      const deltas = snapshot.throughputHistory.slice(1).map((value, index) => {
        return Math.abs(value - (snapshot.throughputHistory[index] ?? value));
      });
      expect(Math.max(...deltas)).toBeGreaterThanOrEqual(15);
    } finally {
      store[key] = previous;
    }
  });
});
