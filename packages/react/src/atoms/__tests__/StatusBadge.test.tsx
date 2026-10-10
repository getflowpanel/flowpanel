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
      expect(tone(healthy)).not.toMatch(/fp-(?:bg|text|border)-ok/);
      expect(tone(healthy)).toContain("fp-text-soft");
    }
    expect(tone("failed")).toMatch(/fp-text-err-ink/);
    expect(tone("degraded")).toMatch(/fp-text-warn-ink/);
    expect(tone("processing")).toMatch(/fp-text-info-ink/);
    expect(tone("pending")).toMatch(/fp-text-info-ink/);
    expect(tone("canceled")).toContain("fp-text-faint");
  });

  it("shows a label while inferring the tone from the status", () => {
    const { container } = render(<StatusBadge status="failed" label="Ошибка" />);
    expect(screen.getByText("Ошибка")).toBeTruthy();
    expect(container.textContent).not.toContain("failed");
    expect(container.querySelector("span")?.className).toMatch(/fp-text-err-ink/);
  });

  it("honours an explicit tone override", () => {
    const { container } = render(<StatusBadge status="whatever" tone="err" />);
    expect(container.querySelector("span")?.className).toMatch(/fp-text-err-ink/);
  });

  it("uses compact typography and spacing for table-friendly statuses", () => {
    render(<StatusBadge status="Success" />);

    const badge = screen.getByText("Success");
    expect(badge.classList.contains("fp-text-xs")).toBe(true);
    expect(badge.classList.contains("fp-rounded-sm")).toBe(true);
    expect(badge.classList.contains("fp-leading-4")).toBe(true);
    expect(badge.classList.contains("fp-px-1.5")).toBe(true);
  });
});
