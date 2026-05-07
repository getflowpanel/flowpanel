// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusBadge } from "../StatusBadge.js";

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
});
