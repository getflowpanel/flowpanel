// @vitest-environment happy-dom

import { RU_LABELS } from "@flowpanel/core/labels";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LabelsProvider } from "../../_provider/LabelsContext";
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
        more={{ label: "2 more", href: "/admin/system" }}
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

  it("keeps a long row inside the card on a phone: text and trailing parts clamp to two lines", () => {
    const text = "Payment webhook failing for Stripe EU account";
    render(
      <ListCard
        variant="banner"
        rows={[
          {
            text,
            tone: "err",
            count: "1,284",
            since: "since 3 hours ago",
            meta: "billing-webhooks-eu-west-1",
          },
        ]}
      />,
    );
    const body = screen.getByText(text).closest("[title]") as HTMLElement;
    expect(body.className).toContain("line-clamp-2");
    expect(body.className).toContain("min-w-0");
    const trail = screen.getByTitle("1,284 · since 3 hours ago · billing-webhooks-eu-west-1");
    expect(trail.className).toContain("max-w-[45%]");
    expect(trail.className).toContain("line-clamp-2");
    expect(trail.className).toContain("break-words");
  });

  it("marks a resolved row with an ok glyph, not the info dot", () => {
    const { container } = render(
      <ListCard variant="banner" rows={[{ text: "Webhook recovered", tone: "ok" }]} />,
    );
    const glyph = container.querySelector("[data-fp-glyph]");
    expect(glyph?.textContent).toBe("✓");
    expect(glyph?.className).toContain("text-fp-ok-text");
  });

  it("says each row's tone to a screen reader, in the admin's language", () => {
    const rows = [
      { text: "Scraper down", tone: "err" as const },
      { text: "Slow sync", tone: "info" as const },
    ];
    const { container, rerender } = render(<ListCard variant="banner" rows={rows} />);
    const words = () =>
      [...container.querySelectorAll(".sr-only")].map((node) => node.textContent?.trim());
    expect(words()).toEqual(["Error", "Info"]);
    rerender(
      <LabelsProvider value={RU_LABELS}>
        <ListCard rows={[...rows, { text: "Quiet", tone: "muted" as const }]} />
      </LabelsProvider>,
    );
    expect(words()).toEqual(["Ошибка", "Информация"]);
  });
});
