import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "../components/MetricCard";

describe("MetricCard", () => {
  it("renders sparkline bars when sparkline prop is provided", () => {
    const { container } = render(
      <MetricCard label="Runs" value={42} sparkline={[10, 20, 30, 40, 50]} />,
    );

    // Sparkline container is aria-hidden with flex children as bars
    const sparklineContainer = container.querySelector("[aria-hidden]");
    expect(sparklineContainer).toBeInTheDocument();
    // Should have 5 bar divs inside
    expect(sparklineContainer?.children).toHaveLength(5);
  });

  it("renders trend label for positive and negative directions", () => {
    const { rerender } = render(
      <MetricCard label="Runs" value={100} trend={{ label: "+12%", direction: "positive" }} />,
    );

    expect(screen.getByText("+12%")).toBeInTheDocument();

    rerender(
      <MetricCard label="Runs" value={100} trend={{ label: "-5%", direction: "negative" }} />,
    );

    expect(screen.getByText("-5%")).toBeInTheDocument();
  });
});
