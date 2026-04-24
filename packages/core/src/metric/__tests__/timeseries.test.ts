import { describe, expect, it, vi } from "vitest";
import type { ChartBucket } from "../../widget/types";
import { type TimeseriesParams, timeseries } from "../timeseries";
import type { MetricCtx } from "../types";

const noopCompute = async (
  _ctx: MetricCtx,
  _params: TimeseriesParams,
): Promise<ChartBucket[]> => [];

describe("timeseries()", () => {
  it("calls compute with default range + auto bucket", async () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const compute = vi.fn(
      async (_ctx: MetricCtx, _params: TimeseriesParams): Promise<ChartBucket[]> => [
        { label: "d1", value: 1 },
      ],
    );
    const t = timeseries({ compute, defaultRange: "7d", now: () => now });
    await t({ db: {} });
    expect(compute).toHaveBeenCalledWith(
      { db: {} },
      {
        start: new Date("2026-04-11T00:00:00Z"),
        end: now,
        bucket: "day",
      },
    );
  });

  it("respects explicit defaultBucket", async () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const compute = vi.fn(noopCompute);
    const t = timeseries({ compute, defaultRange: "30d", defaultBucket: "week", now: () => now });
    await t({ db: {} });
    const args = compute.mock.calls[0];
    if (!args) throw new Error("expected compute to be called");
    expect(args[1].bucket).toBe("week");
  });

  it("uses ctx.range when provided and picks sane bucket (defaultBucketFor)", async () => {
    const range = {
      start: new Date("2026-04-17T00:00:00Z"),
      end: new Date("2026-04-18T00:00:00Z"), // 24h → hour
    };
    const compute = vi.fn(noopCompute);
    const t = timeseries({ compute });
    await t({ db: {}, range });
    const args = compute.mock.calls[0];
    if (!args) throw new Error("expected compute to be called");
    expect(args[1].bucket).toBe("hour");
    expect(args[1].start).toBe(range.start);
    expect(args[1].end).toBe(range.end);
  });
});
