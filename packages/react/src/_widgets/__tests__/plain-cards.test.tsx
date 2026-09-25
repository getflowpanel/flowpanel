// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DefaultMetricCard } from "../MetricCardDefault";
import { StatCard } from "../StatCard";

afterEach(cleanup);

describe("plain cards", () => {
  it("drops the metric card's frame but keeps its change and its link", () => {
    const { container } = render(
      <DefaultMetricCard
        plain
        label="Visits"
        value={120}
        delta={{ value: 0.2, vs: "vs previous period", previous: 100 }}
        drilldown="/admin/visits"
      />,
    );
    expect(container.querySelector("[data-plain]")).toBeTruthy();
    expect(container.querySelector(".rounded-fp-lg.border")).toBeNull();
    expect(container.querySelector("[data-delta]")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Visits" }).getAttribute("href")).toBe("/admin/visits");
  });

  it("drops the stat card's frame but keeps its link", () => {
    const { container } = render(<StatCard plain label="Failures" value="3" href="/admin/runs" />);
    expect(container.querySelector("[data-plain]")).toBeTruthy();
    expect(container.querySelector(".rounded-fp-lg.border")).toBeNull();
    expect(screen.getByRole("link", { name: "Failures" }).getAttribute("href")).toBe("/admin/runs");
  });
});
