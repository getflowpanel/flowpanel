// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar } from "../Avatar.js";

afterEach(cleanup);

describe("Avatar", () => {
  it("renders an img when src is given", () => {
    const { container } = render(<Avatar src="/foo.png" alt="Ada" />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/foo.png");
    expect(img?.getAttribute("alt")).toBe("Ada");
  });

  it("renders initials fallback when no src", () => {
    render(<Avatar fallback="Ada" />);
    expect(screen.getByText("AD")).toBeTruthy();
  });

  it("renders '?' when fallback is empty", () => {
    render(<Avatar />);
    expect(screen.getByText("?")).toBeTruthy();
  });
});
