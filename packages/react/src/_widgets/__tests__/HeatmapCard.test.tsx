// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("shades the fill, not the element, so a focus ring keeps its strength, and names the grid once", () => {
    const { container } = render(
      <HeatmapCard
        summary="3 visits in the last 14 days"
        weeks={[week(2), week(3)]}
        months={[]}
        weekdays={[]}
        legend={{ less: "Less", more: "More" }}
      />,
    );
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelector("[data-level='2']")?.className).toContain("bg-fp-data/50");
    expect(container.querySelector("[data-level='3']")?.className).toContain("bg-fp-data/75");
    const cells = [...container.querySelectorAll("[data-level]")];
    expect(cells.some((cell) => cell.className.includes("opacity-"))).toBe(false);
    expect(screen.getByText("3 visits in the last 14 days").getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("puts a linked grid in the tab order once and moves between days with the arrow keys", () => {
    const linked = (w: number) =>
      Array.from({ length: 7 }, (_, d) => ({
        key: `${w}-${d}`,
        level: 1,
        title: `w${w}d${d}`,
        href: `/admin/visits?day=${w}-${d}`,
      }));
    render(
      <HeatmapCard
        summary="Visits"
        weeks={[linked(0), linked(1)]}
        months={[]}
        weekdays={[]}
        legend={{ less: "Less", more: "More" }}
      />,
    );
    const links = screen.getAllByRole("link");
    const stops = links.filter((link) => link.tabIndex === 0);
    expect(stops.map((link) => link.getAttribute("aria-label"))).toEqual(["w1d6"]);
    const last = screen.getByRole("link", { name: "w1d6" });
    last.focus();
    fireEvent.keyDown(last, { key: "ArrowLeft" });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("w0d6");
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("w0d5");
    expect((document.activeElement as HTMLElement).tabIndex).toBe(0);
    expect(last.tabIndex).toBe(-1);
  });
});
