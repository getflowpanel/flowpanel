// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FunnelCard } from "../FunnelCard";

afterEach(cleanup);

const steps = [
  { label: "Visited", value: 1000 },
  { label: "Signed up", value: 400 },
  { label: "Paid", value: 40 },
];

function stepOf(label: string): HTMLElement {
  return screen.getByText(label).closest("[data-step]") as HTMLElement;
}

describe("the worst funnel drop", () => {
  it("marks only the step with the largest drop past alertDrop, in its drop and bar", () => {
    render(<FunnelCard steps={steps} alertDrop={0.5} />);
    const paid = stepOf("Paid");
    expect(paid.getAttribute("data-tone")).toBe("warn");
    expect(screen.getByText("Paid").className).toContain("fp-text-soft");
    expect(screen.getByText("Paid").className).not.toContain("fp-text-warn-ink");
    expect(paid.querySelector(".fp-bg-warn")).toBeTruthy();
    expect(screen.getByText("−90%").className).toContain("fp-text-warn-ink");
    expect(paid.querySelector(".fp-sr-only")?.textContent).toBe("Warning ");
    expect(stepOf("Signed up").getAttribute("data-tone")).toBeNull();
    expect(stepOf("Signed up").querySelector(".fp-sr-only")).toBeNull();
    expect(stepOf("Signed up").querySelector(".fp-bg-data")).toBeTruthy();
  });

  it("tones nothing without an alertDrop, and prints drops in muted text", () => {
    render(<FunnelCard steps={steps} />);
    expect(document.querySelector("[data-tone='warn']")).toBeNull();
    expect(document.querySelector(".fp-bg-warn")).toBeNull();
    expect(screen.getByText("−90%").className).toContain("fp-text-faint");
    expect(screen.getByText("−60%").className).toContain("fp-text-faint");
  });

  it("marks nothing when no drop exceeds alertDrop", () => {
    render(<FunnelCard steps={steps} alertDrop={0.95} />);
    expect(document.querySelector("[data-tone='warn']")).toBeNull();
  });

  it("marks nothing when every drop stays under alertDrop", () => {
    render(
      <FunnelCard
        alertDrop={0.5}
        steps={[
          { label: "Visited", value: 100 },
          { label: "Signed up", value: 60 },
        ]}
      />,
    );
    expect(document.querySelector("[data-tone='warn']")).toBeNull();
  });

  it("marks nothing for a single step", () => {
    render(<FunnelCard steps={[{ label: "Visited", value: 10 }]} />);
    expect(document.querySelector("[data-tone='warn']")).toBeNull();
  });

  it("marks only the first of two equal worst drops", () => {
    render(
      <FunnelCard
        alertDrop={0.5}
        steps={[
          { label: "A", value: 100 },
          { label: "B", value: 20 },
          { label: "C", value: 4 },
        ]}
      />,
    );
    expect(document.querySelectorAll("[data-tone='warn']")).toHaveLength(1);
    expect(stepOf("B").getAttribute("data-tone")).toBe("warn");
  });

  it("reads no drop into a negative step value", () => {
    render(
      <FunnelCard
        steps={[
          { label: "Opened", value: 10 },
          { label: "Refunded", value: -5 },
        ]}
      />,
    );
    expect(document.querySelector("[data-tone='warn']")).toBeNull();
    expect(document.body.textContent).not.toContain("−150%");
  });

  it("keys steps by position, so two equal labels raise no warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FunnelCard
        steps={[
          { label: "Step", value: 10 },
          { label: "Step", value: 5 },
        ]}
      />,
    );
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("shows growth over the step before as a plus, not a drop", () => {
    const { container } = render(
      <FunnelCard
        steps={[
          { label: "Trials", value: 10 },
          { label: "Referrals", value: 15 },
        ]}
      />,
    );
    expect(container.textContent).toContain("+50%");
    expect(container.textContent).not.toContain("−-");
    expect(screen.getByText("+50%").className).toContain("fp-text-faint");
  });
});
