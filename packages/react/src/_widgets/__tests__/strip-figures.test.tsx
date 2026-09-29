// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatStrip } from "../../_layout/StatStrip";
import { ExpiredCard } from "../ExpiredCard";
import { MetricCard } from "../MetricCard";
import { StatCard } from "../StatCard";

afterEach(cleanup);

const SIZE = /(?:^|\s)(text-(?:xs|sm|base|lg|xl|2xl|3xl|\[[^\]]+\]))(?=\s|$)/;

function sizeOf(text: string): string | undefined {
  return screen.getByText(text).className.match(SIZE)?.[1];
}

describe("figures in one strip", () => {
  it("draws a stat, a metric and an expired cell at one figure size", () => {
    render(
      <StatStrip>
        <MetricCard label="Orders" value={1204} plain />
        <StatCard label="Queue" value={37} plain />
        <ExpiredCard label="Old" caption={{ text: "kept for 30 days" }} plain />
      </StatStrip>,
    );
    expect(sizeOf("1,204")).toBe("text-[2rem]");
    expect(sizeOf("37")).toBe("text-[2rem]");
    expect(sizeOf("—")).toBe("text-[2rem]");
  });

  it("keeps a framed stat card's smaller figure", () => {
    render(<StatCard label="Queue" value={37} />);
    expect(sizeOf("37")).toBe("text-xl");
  });

  it("sets a stat's hint as close under its figure as a metric's sublabel", () => {
    render(
      <StatStrip>
        <MetricCard label="Orders" value={1204} sublabel="this week" plain />
        <StatCard label="Queue" value={37} hint="waiting" plain />
      </StatStrip>,
    );
    const gap = (text: string) =>
      screen.getByText(text).className.match(/(?:^|\s)(mt-[\w.]+)/)?.[1];
    expect(gap("waiting")).toBe(gap("this week"));
    expect(screen.getByText("37").parentElement?.className).toContain("space-y-1");
  });
});
