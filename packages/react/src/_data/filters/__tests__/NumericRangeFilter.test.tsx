// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NumericRangeFilter } from "../NumericRangeFilter.js";

afterEach(() => cleanup());

describe("NumericRangeFilter", () => {
  it("emits 'min:' when Min changes", () => {
    const onChange = vi.fn();
    render(<NumericRangeFilter field="age" value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Min"), { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith("10:");
  });

  it("emits null when both sides are empty", () => {
    const onChange = vi.fn();
    render(<NumericRangeFilter field="age" value="10:" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Min"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
