// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComponentsProvider } from "../ComponentsContext.js";
import { EmptyState } from "../../_feedback/EmptyState.js";
import { MetricCard } from "../../_widgets/MetricCard.js";

afterEach(() => cleanup());

describe("EmptyState wrapper", () => {
  it("renders default", () => {
    render(<EmptyState title="No rows" />);
    expect(screen.getByText("No rows")).toBeTruthy();
  });
  it("renders override", () => {
    function Custom({ title }: { title: string }) {
      return <span data-testid="custom">{title.toUpperCase()}</span>;
    }
    render(
      <ComponentsProvider value={{ EmptyState: Custom }}>
        <EmptyState title="No rows" />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom").textContent).toBe("NO ROWS");
  });
});

describe("MetricCard wrapper", () => {
  it("renders default", () => {
    render(<MetricCard label="Users" value={42} />);
    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });
  it("renders override", () => {
    function Custom({ label, value }: { label: string; value: number | string }) {
      return (
        <div data-testid="custom-metric">
          {label}={String(value)}
        </div>
      );
    }
    render(
      <ComponentsProvider value={{ MetricCard: Custom }}>
        <MetricCard label="Users" value={42} />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("custom-metric").textContent).toBe("Users=42");
  });
});
