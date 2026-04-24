import { describe, expect, it, vi } from "vitest";
import { metric } from "../metric";

describe("metric()", () => {
  it("returns { value } that invokes compute with the configured default range", async () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const compute = vi.fn(async () => 42);
    const m = metric({ compute, defaultRange: "7d", now: () => now });
    const result = await m.value({ db: {} });
    expect(result).toBe(42);
    expect(compute).toHaveBeenCalledWith(
      { db: {} },
      { start: new Date("2026-04-11T00:00:00Z"), end: now },
    );
  });

  it("uses the range from ctx when present (user-supplied time-range)", async () => {
    const range = {
      start: new Date("2026-01-01T00:00:00Z"),
      end: new Date("2026-02-01T00:00:00Z"),
    };
    const compute = vi.fn(async () => 99);
    const m = metric({ compute });
    await m.value({ db: {}, range });
    expect(compute).toHaveBeenCalledWith({ db: {}, range }, range);
  });

  it('when trend: "vs-previous-period", computes both ranges and returns delta/deltaPercent/direction', async () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const compute = vi.fn(async (_ctx: unknown, r: { start: Date; end: Date }) =>
      r.end.getTime() === now.getTime() ? 120 : 100,
    );
    const m = metric({
      compute,
      defaultRange: "30d",
      trend: "vs-previous-period",
      now: () => now,
    });
    const trend = await m.trend?.({ db: {} });
    expect(trend).toEqual({
      delta: 20,
      deltaPercent: 20,
      direction: "up",
      period: "vs previous 30d",
    });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("trend returns null when either side is null", async () => {
    const compute = vi.fn(async () => null as number | null);
    const m = metric({ compute, trend: "vs-previous-period" });
    expect(await m.trend?.({ db: {} })).toBeNull();
  });

  it("trend direction is 'flat' when values are equal, 'down' when current < previous", async () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const makeM = (curr: number, prev: number) =>
      metric({
        compute: async (_c, r) => (r.end.getTime() === now.getTime() ? curr : prev),
        trend: "vs-previous-period",
        defaultRange: "7d",
        now: () => now,
      });
    expect((await makeM(50, 50).trend?.({ db: {} }))?.direction).toBe("flat");
    expect((await makeM(30, 60).trend?.({ db: {} }))?.direction).toBe("down");
  });

  it("no trend key when trend is not configured", () => {
    const m = metric({ compute: async () => 1 });
    expect(m.trend).toBeUndefined();
  });
});
