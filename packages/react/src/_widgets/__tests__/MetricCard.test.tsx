// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MetricCard } from "../MetricCard";

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
    expect(link.className).toContain("h-full");
    expect(link.firstElementChild?.className).toContain("h-full");
  });

  it("fills the grid slot when it is not a drilldown link", () => {
    const { container } = render(<MetricCard label="X" value={1} />);
    expect(container.firstElementChild?.className).toContain("h-full");
  });

  it("applies tone data-attribute", () => {
    const { container } = render(<MetricCard label="X" value={1} tone="warn" />);
    expect(container.querySelector("[data-tone='warn']")).toBeTruthy();
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

  it("reads a fall as good news for goodWhen: down", () => {
    const { container } = render(
      <MetricCard
        label="Churn"
        value={3}
        delta={{ value: -0.2, vs: "prev week", goodWhen: "down" }}
      />,
    );
    expect(container.querySelector(".text-fp-ok-text")).toBeTruthy();
    expect(screen.getByText(/▼/)).toBeTruthy();
  });

  it("reads a rise as bad news for goodWhen: down", () => {
    const { container } = render(
      <MetricCard
        label="Churn"
        value={3}
        delta={{ value: 0.2, vs: "prev week", goodWhen: "down" }}
      />,
    );
    expect(container.querySelector(".text-fp-err-text")).toBeTruthy();
  });

  it("renders icon when given", () => {
    render(<MetricCard label="Users" value={1} icon="👥" />);
    expect(screen.getByText("👥")).toBeTruthy();
  });

  it("omits any icon markup when not given", () => {
    const { container } = render(<MetricCard label="Users" value={1} />);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  it("shows the value compared against, worded by the labels", () => {
    render(
      <MetricCard
        label="Signups"
        value={120}
        delta={{ value: 0.2, vs: "vs last week", previous: 100 }}
      />,
    );
    expect(screen.getByText("was 100")).toBeTruthy();
  });

  it("shows the absolute change for a small base", () => {
    const { container } = render(
      <MetricCard label="Replies" value={4} delta={{ value: 3, vs: "prev", previous: 1 }} />,
    );
    expect(screen.getByText(/\+3 · prev/)).toBeTruthy();
    expect(screen.getByText("was 1")).toBeTruthy();
    expect(container.querySelector("[data-delta='good']")).toBeTruthy();
  });

  it("reads a rate's change in percentage points", () => {
    render(
      <MetricCard
        label="Conversion"
        value={0.43}
        format="percent"
        delta={{ value: 0.075, vs: "prev", previous: 0.4 }}
      />,
    );
    expect(screen.getByText(/\+3 pp · prev/)).toBeTruthy();
    expect(screen.getByText("was 40%")).toBeTruthy();
  });

  it("renders a near-zero change without a glyph or a colour", () => {
    const { container } = render(
      <MetricCard label="Visits" value={100} delta={{ value: 0.001, vs: "prev" }} />,
    );
    expect(container.querySelector("[data-delta='flat']")?.className).toContain("text-fp-text-3");
    expect(screen.queryByText(/▲|▼/)).toBeNull();
  });
});
