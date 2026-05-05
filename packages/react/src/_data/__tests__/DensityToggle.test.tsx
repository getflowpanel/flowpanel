// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DensityToggle } from "../DensityToggle.js";

afterEach(cleanup);

describe("DensityToggle", () => {
  it("shows current density in accessible label", () => {
    render(<DensityToggle density="comfortable" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /comfortable/i })).toBeTruthy();
  });

  it("toggles between compact and comfortable on click", () => {
    const onChange = vi.fn();
    render(<DensityToggle density="comfortable" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("compact");
  });
});
