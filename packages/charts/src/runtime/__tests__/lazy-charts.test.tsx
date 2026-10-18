// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../chart-body", () => ({
  default: ({ kind, seriesLabels }: { kind: string; seriesLabels?: Record<string, string> }) => {
    if (kind === "barChart") throw new Error("drawing failed");
    return (
      <p data-testid="chart">
        {kind} {seriesLabels?.runs ?? ""}
      </p>
    );
  },
}));

import { renderToString } from "react-dom/server";
import { AreaChart, BarChart, PieChart } from "../lazy-charts";

afterEach(cleanup);

const data = [{ day: "Mon", runs: 3 }];

describe("the exported chart components", () => {
  it("hold the chart's height with a skeleton, then draw with the series names", async () => {
    const { container } = render(
      <AreaChart
        data={data}
        options={{ x: "day", y: "runs", height: 180 }}
        names={{ runs: "Runs" }}
      />,
    );
    expect(container.querySelector<HTMLElement>("[aria-hidden]")?.style.height).toBe("180px");
    expect((await screen.findByTestId("chart")).textContent).toBe("areaChart Runs");
  });

  it("draw a pie through the same lazy body", async () => {
    render(<PieChart data={data} options={{ category: "day", value: "runs" }} />);
    expect((await screen.findByTestId("chart")).textContent).toContain("pieChart");
  });

  it("show the empty line at once for no rows, so the card does not collapse after a skeleton", () => {
    const { container } = render(<AreaChart data={[]} options={{ x: "day", y: "runs" }} />);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
    expect(container.textContent).toBe("No data yet");
  });

  it("render the skeleton on the server, not an empty chart box", () => {
    const html = renderToString(
      <AreaChart data={data} options={{ x: "day", y: "runs", height: 180 }} />,
    );
    expect(html).toContain("height:180px");
    expect(html).not.toContain("areaChart");
  });

  it("keep a chart that fails to one line instead of taking the page down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<BarChart data={data} options={{ x: "day", y: "runs" }} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't reach the server");
  });

  it("reach Recharts only through a dynamic import", () => {
    for (const file of [
      "../lazy-charts.tsx",
      "../lazy-body.ts",
      "../render-chart.tsx",
      "../../index.tsx",
    ]) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toMatch(/from "recharts"/);
    }
  });
});
