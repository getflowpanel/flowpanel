// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrackerCard } from "../TrackerCard";

afterEach(cleanup);

const rows = [
  {
    key: "kwork",
    label: "Kwork",
    tone: "err" as const,
    href: "/admin/scraper_run?f_platform=kwork",
    summary: "last success 12:40",
    cells: [
      { tone: "ok" as const, title: "10:00 · 5% · 40 observed" },
      { tone: "err" as const, title: "11:00 · 66.7% · 30 observed" },
      { tone: "muted" as const, title: "12:00 · 10% · 10 observed" },
    ],
  },
];

describe("TrackerCard", () => {
  it("draws one block per cell, each named for a screen reader and toned", () => {
    render(<TrackerCard label="Marketplaces" rows={rows} />);
    const blocks = screen.getAllByRole("img");
    expect(blocks.map((b) => b.getAttribute("aria-label"))).toEqual(
      rows[0]?.cells.map((c) => c.title),
    );
    expect(blocks.map((b) => b.getAttribute("data-tone"))).toEqual(["ok", "err", "muted"]);
    expect(blocks[1]?.className).toContain("bg-fp-err");
    expect(blocks[2]?.className).toContain("bg-fp-bg-3");
  });

  it("links the row label, and wraps the summary under it on a phone", () => {
    render(<TrackerCard rows={rows} />);
    expect(screen.getByRole("link", { name: "Kwork" }).getAttribute("href")).toBe(
      "/admin/scraper_run?f_platform=kwork",
    );
    const summary = screen.getByText("last success 12:40");
    expect(summary.className).toContain("w-full");
  });

  it("gives every row's summary the same fixed width, so the strips line up on desktop", () => {
    const { container } = render(
      <TrackerCard
        rows={[
          { ...rows[0], key: "a", summary: "1m" } as (typeof rows)[0],
          { ...rows[0], key: "b", summary: "a much longer last success label" } as (typeof rows)[0],
        ]}
      />,
    );
    const summaries = [...container.querySelectorAll("li")].map(
      (li) => li.lastElementChild as HTMLElement,
    );
    expect(summaries).toHaveLength(2);
    const [first, second] = summaries;
    expect(first?.className).toBe(second?.className);
    expect(first?.className).toMatch(/sm:w-\d/);
    expect(first?.className).not.toContain("sm:w-auto");
  });

  it("hides a block without a title from screen readers instead of naming it empty", () => {
    const { container } = render(
      <TrackerCard
        rows={[{ key: "a", label: "A", tone: "ok", cells: [{ tone: "ok", title: "" }] }]}
      />,
    );
    const block = container.querySelector("[data-tone='ok']:not(li)");
    expect(block?.getAttribute("role")).toBeNull();
    expect(block?.getAttribute("aria-label")).toBeNull();
    expect(block?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryAllByRole("img")).toEqual([]);
  });

  it("shows the empty state without rows", () => {
    render(<TrackerCard rows={[]} emptyState="No data yet" />);
    expect(screen.getByText("No data yet")).toBeTruthy();
  });

  it("keeps a truncated row label and summary readable on hover", () => {
    render(
      <TrackerCard
        rows={[
          {
            key: "a",
            label: "api-gateway-production-eu",
            tone: "ok",
            summary: "99.98% uptime over 90 days",
            cells: [],
          },
        ]}
      />,
    );
    expect(screen.getByTitle("api-gateway-production-eu").className).toContain("truncate");
    expect(screen.getByTitle("99.98% uptime over 90 days").className).toContain("truncate");
  });
});
