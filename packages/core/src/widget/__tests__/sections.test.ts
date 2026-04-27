import { describe, expect, it } from "vitest";
import { resolveDashboard, resolveSections } from "../builder";
import type { DashboardConfig } from "../types";

describe("dashboards.sections", () => {
  const config: DashboardConfig = {
    sections: [
      {
        title: "Revenue",
        description: "MRR + churn",
        widgets: (w) => [
          w.metric({ label: "MRR", value: async () => 1000 }),
          w.metric({ label: "Churn", value: async () => 0.05 }),
        ],
      },
      {
        title: "Users",
        widgets: (w) => [w.metric({ label: "Total", value: async () => 500 })],
      },
    ],
  };

  it("resolveDashboard flattens sections into one widget list", () => {
    const widgets = resolveDashboard(config);
    expect(widgets.map((w) => w.label)).toEqual(["MRR", "Churn", "Total"]);
  });

  it("resolveSections returns title + widgetIds per section", () => {
    const widgets = resolveDashboard(config);
    const ids = widgets.map((w) => w.id);
    const sections = resolveSections(config);
    expect(sections).toEqual([
      {
        title: "Revenue",
        description: "MRR + churn",
        widgetIds: [ids[0], ids[1]],
      },
      { title: "Users", widgetIds: [ids[2]] },
    ]);
  });

  it("resolveSections returns null for flat configs", () => {
    expect(resolveSections([])).toBeNull();
    expect(resolveSections((w) => [w.metric({ label: "x", value: async () => 1 })])).toBeNull();
  });
});
