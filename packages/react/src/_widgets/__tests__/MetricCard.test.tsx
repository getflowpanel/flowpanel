// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MetricCard } from "../MetricCard.js";

afterEach(() => cleanup());

describe("MetricCard", () => {
  it("renders numeric value formatted", () => {
    render(<MetricCard label="Signups" value={1234} format="number" />);
    expect(screen.getByText("1,234")).toBeTruthy();
  });

  it("renders currency", () => {
    render(<MetricCard label="Revenue" value={4500} format="currency" />);
    expect(screen.getByText("$4,500")).toBeTruthy();
  });

  it("renders drilldown link when href given", () => {
    render(<MetricCard label="X" value={1} drilldown="/x" />);
    const link = screen.getByRole("link", { name: /x/i });
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).getAttribute("href")).toBe("/x");
  });

  it("applies tone data-attribute", () => {
    const { container } = render(<MetricCard label="X" value={1} tone="warning" />);
    expect(container.querySelector("[data-tone='warning']")).toBeTruthy();
  });

  it("renders string value as-is", () => {
    render(<MetricCard label="Status" value="healthy" />);
    expect(screen.getByText("healthy")).toBeTruthy();
  });

  it("renders delta with upward caret for positive", () => {
    render(<MetricCard label="Visits" value={100} delta={{ value: 0.123, vs: "prev week" }} />);
    expect(screen.getByText(/▲/)).toBeTruthy();
    expect(screen.getByText(/prev week/)).toBeTruthy();
  });
});
