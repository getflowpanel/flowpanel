// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FilterField } from "../FilterField";

afterEach(() => cleanup());

describe("FilterField", () => {
  it("uses a 44px mobile pill and restores desktop density at sm", () => {
    render(
      <FilterField label="Plan">
        <button type="button">All</button>
      </FilterField>,
    );

    const wrapper = screen.getByText("Plan").parentElement;
    expect(wrapper?.className).toContain("h-11");
    expect(wrapper?.className).toContain("sm:h-9");
  });
});
