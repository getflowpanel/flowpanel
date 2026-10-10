// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DefaultMetricCard } from "../MetricCardDefault";

afterEach(cleanup);

function classesOf(el: Element | null | undefined): string[] {
  return (el?.getAttribute("class") ?? "").split(/\s+/);
}

describe("a metric card on a narrow slot", () => {
  it("moves the sparkline under the value and bounds the value by the card", () => {
    render(
      <DefaultMetricCard label="New users" value={1234} format="number" sparkline={[1, 3, 2, 5]} />,
    );
    const value = screen.getByText("1,234");
    const column = value.parentElement?.parentElement;
    const row = column?.parentElement;
    const sparkline = screen.getByRole("img", { name: "Trend" });

    expect(classesOf(value)).toEqual(expect.arrayContaining(["fp-min-w-0", "fp-truncate"]));
    expect(classesOf(value.parentElement)).toContain("fp-whitespace-nowrap");
    expect(classesOf(column)).not.toContain("fp-min-w-0");
    expect(classesOf(column)).toEqual(
      expect.arrayContaining(["fp-grow", "fp-basis-0", "fp-max-w-full"]),
    );
    expect(sparkline.parentElement).toBe(row);
    expect(classesOf(row)).toContain("fp-flex-wrap");
  });

  it("keeps the full label reachable when the heading runs out of room", () => {
    const label = "New users from the Telegram channel this week";
    render(<DefaultMetricCard label={label} value={3} />);
    expect(screen.getByText(label).getAttribute("title")).toBe(label);
  });
});
