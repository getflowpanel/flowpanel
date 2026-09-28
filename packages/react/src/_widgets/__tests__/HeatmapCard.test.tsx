// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HeatmapCard } from "../HeatmapCard";

afterEach(cleanup);

const week = (level: number) =>
  Array.from({ length: 7 }, (_, i) => ({
    key: `d${level}${i}`,
    level,
    title: `day ${i}: ${level}`,
  }));

describe("HeatmapCard", () => {
  it("draws one cell per day, named by its summary, scrolling sideways on a phone", () => {
    const { container } = render(
      <HeatmapCard
        label="Visits"
        summary="3 visits in the last 14 days"
        weeks={[week(0), week(4)]}
        months={[{ index: 0, label: "Sep" }]}
        weekdays={[{ row: 0, label: "Mon" }]}
        legend={{ less: "Less", more: "More" }}
      />,
    );
    const grid = screen.getByRole("img", { name: "3 visits in the last 14 days" });
    expect(grid.querySelectorAll("[data-level]")).toHaveLength(14);
    expect(grid.querySelector("[data-level='0']")?.className).toContain("bg-fp-bg-3");
    expect(grid.querySelector("[title='day 0: 4']")).toBeTruthy();
    expect(container.querySelector(".overflow-x-auto")).toBeTruthy();
    expect(screen.getByText("Less")).toBeTruthy();
    expect(screen.getByText("Sep")).toBeTruthy();
  });

  it("links days that have an href and shows the empty state instead of the grid", () => {
    render(
      <HeatmapCard
        summary="1 in the last 7 days"
        weeks={[
          [
            { key: "a", level: 4, title: "Sep 25: 1", href: "/admin/visits?day=25" },
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        ]}
        months={[]}
        weekdays={[]}
        legend={{ less: "Less", more: "More" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Sep 25: 1" }).getAttribute("href")).toBe(
      "/admin/visits?day=25",
    );
    cleanup();
    render(
      <HeatmapCard
        summary="0"
        weeks={[]}
        months={[]}
        weekdays={[]}
        legend={{ less: "", more: "" }}
        emptyState="No visits"
      />,
    );
    expect(screen.getByText("No visits")).toBeTruthy();
  });
});
