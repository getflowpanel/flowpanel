import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "../components/MetricCard.js";

describe("MetricCard", () => {
  it("renders sparkline bars when sparkline prop is provided", () => {
    const { container } = render(
      <MetricCard label="Runs" value={42} sparkline={[10, 20, 30, 40, 50]} />,
    );

    // Sparkline container is aria-hidden with flex children as bars
    const sparklineContainer = container.querySelector("[aria-hidden]");
    expect(sparklineContainer).toBeInTheDocument();
    // Should have 5 bar divs inside
    expect(sparklineContainer!.children).toHaveLength(5);
  });

  it("shows trend arrow with correct color", () => {
    const { rerender } = render(<MetricCard label="Runs" value={100} trend="+12%" />);

    const positive = screen.getByText("+12%");
    expect(positive).toHaveStyle({ color: "var(--fp-ok)" });

    rerender(<MetricCard label="Runs" value={100} trend="-5%" />);

    const negative = screen.getByText("-5%");
    expect(negative).toHaveStyle({ color: "var(--fp-err)" });
  });
});
