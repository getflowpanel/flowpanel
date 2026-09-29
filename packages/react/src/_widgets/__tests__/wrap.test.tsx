// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarsCard } from "../BarsCard";
import { FunnelCard } from "../FunnelCard";
import { KvCard } from "../KvCard";
import { ListCard } from "../ListCard";
import { DefaultMetricCard } from "../MetricCardDefault";
import { StatCard } from "../StatCard";
import { StatGroupCard } from "../StatGroupCard";

afterEach(cleanup);

const LONG = "Telegram channel: 0 subscribers this week — the product is silent";

function expectWrapped(el: HTMLElement): void {
  expect(el.className).toContain("line-clamp-2");
  expect(el.className).toContain("break-words");
  expect(el.className).not.toContain("truncate");
  expect(el.getAttribute("title")).toBe(LONG);
}

describe("long widget text wraps to two lines", () => {
  it("wraps a stat hint and keeps the value on one line", () => {
    render(<StatCard label="Runs" value={1200} format="number" hint={LONG} />);
    expectWrapped(screen.getByText(LONG));
    expect(screen.getByText("1,200").className).toContain("truncate");
  });

  it("wraps a metric and a stat title, so a narrow card still says what it counts", () => {
    render(<DefaultMetricCard label={LONG} value={3} />);
    expectWrapped(screen.getByText(LONG));
    cleanup();
    render(<StatCard label={LONG} value={3} />);
    expectWrapped(screen.getByText(LONG));
  });

  it("wraps a metric sublabel", () => {
    render(<DefaultMetricCard label="Runs" value={3} sublabel={LONG} />);
    expectWrapped(screen.getByText(LONG));
  });

  it("wraps a kv value and keeps the label truncated", () => {
    render(<KvCard items={[{ label: "Priority", value: LONG }]} />);
    expectWrapped(screen.getByText(LONG));
    expect(screen.getByText("Priority").className).toContain("truncate");
  });

  it("wraps a list row's text and meta", () => {
    render(<ListCard rows={[{ text: LONG, meta: LONG, href: "/admin/x" }]} />);
    const [text, meta] = screen.getAllByTitle(LONG);
    expectWrapped(text as HTMLElement);
    expectWrapped(meta as HTMLElement);
    expect(screen.getByRole("link").textContent).toBe(LONG);
  });

  it("wraps a bar label", () => {
    render(<BarsCard rows={[{ label: LONG, value: 4 }]} />);
    expectWrapped(screen.getByText(LONG));
  });

  it("wraps a stat group value and stretches the card to its row", () => {
    const { container } = render(
      <StatGroupCard
        stats={[
          { label: "ID", value: LONG },
          { label: "MRR", value: 1234, format: "currency" },
        ]}
      />,
    );
    const value = screen.getByText(LONG);
    expectWrapped(value);
    expect(value.className).toContain("min-w-0");
    expect((container.firstElementChild as HTMLElement).className).toContain("h-full");
  });

  it("wraps a funnel step label", () => {
    render(<FunnelCard steps={[{ label: LONG, value: 4 }]} />);
    expectWrapped(screen.getByText(LONG));
  });
});
