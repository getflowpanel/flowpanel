// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../Badge.js";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Pro</Badge>);
    expect(screen.getByText("Pro")).toBeTruthy();
  });
  it("applies tone classes", () => {
    const { container } = render(<Badge tone="accent">A</Badge>);
    const el = container.querySelector("span");
    expect(el?.className).toMatch(/fp-accent/);
  });
});
