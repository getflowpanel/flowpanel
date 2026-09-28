// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListCard } from "../ListCard";

afterEach(cleanup);

describe("banner list", () => {
  it("marks each row with a glyph as well as a colour, and tints by the worst", () => {
    const { container } = render(
      <ListCard
        variant="banner"
        rows={[
          { text: "Scraper down", tone: "err", count: "1" },
          { text: "Bans on kwork", tone: "warn", since: "3 hours ago", meta: "kwork" },
          { text: "Slow sync", tone: "info" },
        ]}
        more={{ text: "2 more", href: "/admin/system" }}
      />,
    );
    const glyphs = [...container.querySelectorAll("[data-fp-glyph]")].map(
      (node) => node.textContent,
    );
    expect(glyphs).toEqual(["✕", "▲", "●"]);
    expect(container.querySelector("[data-fp-banner]")?.getAttribute("data-fp-banner")).toBe("err");
    expect(screen.getByText("3 hours ago · kwork")).toBeTruthy();
    expect(screen.getByRole("link", { name: "2 more" }).getAttribute("href")).toBe("/admin/system");
  });

  it("says all clear with a check when nothing is on fire", () => {
    const { container } = render(<ListCard variant="banner" rows={[]} allClear="All clear" />);
    expect(screen.getByText("All clear")).toBeTruthy();
    expect(container.querySelector("[data-fp-banner]")?.getAttribute("data-fp-banner")).toBe(
      "clear",
    );
  });

  it("shows a plain list row's count and age beside its meta", () => {
    render(
      <ListCard
        rows={[{ text: "Payout failed", count: "37", since: "5 minutes ago", meta: "stripe" }]}
      />,
    );
    expect(screen.getByText("37 · 5 minutes ago · stripe")).toBeTruthy();
  });

  it("keeps the caption under the banner's title", () => {
    const { container } = render(
      <ListCard
        variant="banner"
        label="On fire"
        rows={[]}
        allClear="All clear"
        caption={{ text: "Checked hourly" }}
      />,
    );
    expect(container.querySelector("[data-fp-caption]")?.textContent).toBe("Checked hourly");
  });
});
