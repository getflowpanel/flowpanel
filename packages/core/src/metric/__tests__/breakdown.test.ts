import { describe, expect, it, vi } from "vitest";
import type { ChartBucket } from "../../widget/types";
import { type BreakdownParams, breakdown } from "../breakdown";
import type { MetricCtx } from "../types";

describe("breakdown()", () => {
  it("passes ctx + resolved range to compute when defaultRange set", async () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const compute = vi.fn(
      async (_ctx: MetricCtx, _params: BreakdownParams): Promise<ChartBucket[]> => [
        { label: "gpt-4", value: 100 },
      ],
    );
    const b = breakdown({ compute, defaultRange: "7d", now: () => now });
    const result = await b({ db: {} });
    expect(result).toEqual([{ label: "gpt-4", value: 100 }]);
    expect(compute).toHaveBeenCalledWith(
      { db: {} },
      {
        range: { start: new Date("2026-04-11T00:00:00Z"), end: now },
        limit: undefined,
      },
    );
  });

  it("forwards limit when set", async () => {
    const compute = vi.fn(
      async (_ctx: MetricCtx, _params: BreakdownParams): Promise<ChartBucket[]> => [],
    );
    const b = breakdown({ compute, limit: 5 });
    await b({ db: {} });
    const args = compute.mock.calls[0];
    if (!args) throw new Error("expected compute to be called");
    expect(args[1].limit).toBe(5);
  });

  it("works without range when defaultRange is unset (range param omitted)", async () => {
    const compute = vi.fn(
      async (_ctx: MetricCtx, _params: BreakdownParams): Promise<ChartBucket[]> => [],
    );
    const b = breakdown({ compute });
    await b({ db: {} });
    const args = compute.mock.calls[0];
    if (!args) throw new Error("expected compute to be called");
    expect(args[1].range).toBeUndefined();
  });

  it("sorts descending by value when sort: 'value-desc'", async () => {
    const compute = vi.fn(
      async (_ctx: MetricCtx, _params: BreakdownParams): Promise<ChartBucket[]> => [
        { label: "b", value: 2 },
        { label: "a", value: 10 },
        { label: "c", value: 5 },
      ],
    );
    const b = breakdown({ compute, sort: "value-desc" });
    const result = await b({ db: {} });
    expect(result.map((r) => r.label)).toEqual(["a", "c", "b"]);
  });

  it("applies limit after sort", async () => {
    const compute = vi.fn(
      async (_ctx: MetricCtx, _params: BreakdownParams): Promise<ChartBucket[]> => [
        { label: "a", value: 1 },
        { label: "b", value: 5 },
        { label: "c", value: 3 },
      ],
    );
    const b = breakdown({ compute, sort: "value-desc", limit: 2 });
    const result = await b({ db: {} });
    expect(result).toEqual([
      { label: "b", value: 5 },
      { label: "c", value: 3 },
    ]);
  });
});
