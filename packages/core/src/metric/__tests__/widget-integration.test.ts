import { describe, expect, it } from "vitest";
import { createWidgetBuilder } from "../../widget/builder";
import { evaluateWidget } from "../../widget/evaluator";
import { metric } from "../metric";

describe("metric() integration with w.metric()", () => {
  it("spreads cleanly into w.metric and produces value + trend data", async () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const revenue = metric({
      compute: async (_ctx, r) => (r.end.getTime() === now.getTime() ? 120 : 100),
      defaultRange: "30d",
      trend: "vs-previous-period",
      now: () => now,
    });

    const w = createWidgetBuilder();
    const widget = w.metric({
      label: "Revenue",
      format: "money",
      ...revenue,
    });

    expect(widget.type).toBe("metric");
    const data = await evaluateWidget(widget, { db: {} });
    expect(data).toMatchObject({
      type: "metric",
      value: 120,
      trend: { delta: 20, direction: "up", deltaPercent: 20 },
    });
  });
});
