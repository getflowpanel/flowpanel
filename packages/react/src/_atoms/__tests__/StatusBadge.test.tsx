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

  it("maps 'active' to ok tone classes", () => {
    const { container } = render(<StatusBadge status="active" />);
    expect(container.querySelector("span")?.className).toMatch(/fp-ok/);
  });

  it("honours an explicit tone override", () => {
    const { container } = render(<StatusBadge status="whatever" tone="err" />);
    expect(container.querySelector("span")?.className).toMatch(/fp-err/);
  });

  it("uses compact typography and spacing for table-friendly statuses", () => {
    render(<StatusBadge status="Success" />);

    const badge = screen.getByText("Success");
    expect(badge.classList.contains("text-[11px]")).toBe(true);
    expect(badge.classList.contains("leading-4")).toBe(true);
    expect(badge.classList.contains("px-1.5")).toBe(true);
  });
});
