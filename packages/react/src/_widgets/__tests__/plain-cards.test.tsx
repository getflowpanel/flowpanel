// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorCard } from "../../_feedback/ErrorCard";
import { ExpiredCard } from "../ExpiredCard";
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

  it("drops an expired card's frame inside a strip", () => {
    const { container } = render(
      <ExpiredCard plain label="Revenue" caption={{ text: "No data: kept for 30 days" }} />,
    );
    const cell = container.querySelector("[data-fp-expired]") as HTMLElement;
    expect(cell.hasAttribute("data-plain")).toBe(true);
    expect(cell.className).not.toContain("border");
    expect(cell.className).not.toContain("shadow");
  });

  it("drops an error card's frame inside a strip and keeps it elsewhere", () => {
    const { container, rerender } = render(<ErrorCard plain error={new Error("boom")} />);
    const cell = () => container.querySelector("[data-fp-error]") as HTMLElement;
    expect(cell().hasAttribute("data-plain")).toBe(true);
    expect(cell().className).not.toContain("border");
    rerender(<ErrorCard error={new Error("boom")} />);
    expect(cell().className).toContain("border-fp-err/40");
    expect(cell().className).toContain("h-full");
  });
});
