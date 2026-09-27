// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusBadge } from "../StatusBadge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("renders the status text (mixed case)", () => {
    render(<StatusBadge status="Active" />);
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders a failed status", () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText("failed")).toBeTruthy();
  });

  it("keeps a healthy status quiet: colour is for trouble and work in progress", () => {
    const tone = (status: string) =>
      render(<StatusBadge status={status} />).container.querySelector("span")?.className ?? "";
    for (const healthy of ["active", "success", "completed", "healthy"]) {
      expect(tone(healthy)).not.toMatch(/fp-ok/);
      expect(tone(healthy)).toContain("text-fp-text-2");
    }
    expect(tone("failed")).toMatch(/fp-err/);
    expect(tone("degraded")).toMatch(/fp-warn/);
    expect(tone("processing")).toMatch(/fp-info/);
    expect(tone("pending")).toMatch(/fp-info/);
    expect(tone("canceled")).toContain("text-fp-text-3");
  });

  it("shows a label while inferring the tone from the status", () => {
    const { container } = render(<StatusBadge status="failed" label="Ошибка" />);
    expect(screen.getByText("Ошибка")).toBeTruthy();
    expect(container.textContent).not.toContain("failed");
    expect(container.querySelector("span")?.className).toMatch(/fp-err/);
  });

  it("honours an explicit tone override", () => {
    const { container } = render(<StatusBadge status="whatever" tone="err" />);
    expect(container.querySelector("span")?.className).toMatch(/fp-err/);
  });

  it("uses compact typography and spacing for table-friendly statuses", () => {
    render(<StatusBadge status="Success" />);

    const badge = screen.getByText("Success");
    expect(badge.classList.contains("text-xs")).toBe(true);
    expect(badge.classList.contains("rounded-fp-sm")).toBe(true);
    expect(badge.classList.contains("leading-4")).toBe(true);
    expect(badge.classList.contains("px-1.5")).toBe(true);
  });
});
