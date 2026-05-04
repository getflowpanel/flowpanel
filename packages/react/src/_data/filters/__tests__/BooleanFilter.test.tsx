// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BooleanFilter } from "../BooleanFilter.js";

afterEach(() => cleanup());

describe("BooleanFilter", () => {
  it("renders the current state via SelectValue", () => {
    const onChange = vi.fn();
    const { rerender } = render(<BooleanFilter field="active" value={null} onChange={onChange} />);
    // Placeholder 'Any' visible when no value
    expect(screen.getByText("Any")).toBeTruthy();

    rerender(<BooleanFilter field="active" value="true" onChange={onChange} />);
    expect(screen.getByText("Yes")).toBeTruthy();
  });

  it("respects custom labels", () => {
    const onChange = vi.fn();
    render(
      <BooleanFilter
        field="active"
        value="false"
        onChange={onChange}
        trueLabel="Enabled"
        falseLabel="Disabled"
      />,
    );
    expect(screen.getByText("Disabled")).toBeTruthy();
  });
});
