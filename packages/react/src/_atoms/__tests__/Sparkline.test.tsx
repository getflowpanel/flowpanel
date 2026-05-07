// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Sparkline } from "../Sparkline.js";

afterEach(cleanup);

describe("Sparkline", () => {
  it("renders null when values are empty", () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an SVG path starting at M0,*", () => {
    render(<Sparkline values={[1, 2, 3, 4]} />);
    const svg = screen.getByRole("img", { name: "trend" });
    const path = svg.querySelector("path");
    expect(path).toBeTruthy();
    expect(path?.getAttribute("d")?.startsWith("M0")).toBe(true);
  });

  it("adds a fill path when fill prop is given", () => {
    const { container } = render(<Sparkline values={[1, 2]} fill="#abc" />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);
  });
});
