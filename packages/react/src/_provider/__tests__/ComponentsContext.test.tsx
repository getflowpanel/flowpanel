// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DefaultEmptyState } from "../../_feedback/EmptyState";
import { DefaultMetricCard } from "../../_widgets/MetricCard";
import { ComponentsProvider } from "../ComponentsContext";
import { useComponents } from "../useComponents";

afterEach(() => cleanup());

function EmptyStateProbe() {
  const { EmptyState } = useComponents();
  return (
    <div data-testid="es-slot">{EmptyState === DefaultEmptyState ? "default" : "override"}</div>
  );
}

function MetricCardProbe() {
  const { MetricCard } = useComponents();
  return (
    <div data-testid="mc-slot">{MetricCard === DefaultMetricCard ? "default" : "override"}</div>
  );
}

describe("ComponentsContext", () => {
  it("returns default slots outside any provider", () => {
    render(<EmptyStateProbe />);
    expect(screen.getByTestId("es-slot").textContent).toBe("default");
  });

  it("ComponentsProvider overrides the specified slot", () => {
    function CustomEmpty({ title }: { title: string }) {
      return <div>{title}</div>;
    }
    render(
      <ComponentsProvider value={{ EmptyState: CustomEmpty }}>
        <EmptyStateProbe />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("es-slot").textContent).toBe("override");
  });

  it("unspecified slots still resolve to defaults under partial override", () => {
    function CustomEmpty({ title }: { title: string }) {
      return <div>{title}</div>;
    }
    render(
      <ComponentsProvider value={{ EmptyState: CustomEmpty }}>
        <MetricCardProbe />
      </ComponentsProvider>,
    );
    expect(screen.getByTestId("mc-slot").textContent).toBe("default");
  });
});
