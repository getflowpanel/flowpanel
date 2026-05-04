// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiSelectFilter } from "../MultiSelectFilter.js";

afterEach(() => cleanup());

describe("MultiSelectFilter", () => {
  const options = [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
    { label: "C", value: "c" },
  ];

  it("shows the selected label for a single value", () => {
    render(<MultiSelectFilter field="tags" value="a" onChange={vi.fn()} options={options} />);
    expect(screen.getByRole("button").textContent).toContain("A");
  });

  it("shows a count summary for multiple values", () => {
    render(<MultiSelectFilter field="tags" value="a,b" onChange={vi.fn()} options={options} />);
    expect(screen.getByRole("button").textContent).toContain("2 selected");
  });

  it("toggles value on checkbox click and emits null when clearing last", () => {
    // Open the popover once so the Radix portal content mounts, then interact.
    const onChange = vi.fn();
    render(<MultiSelectFilter field="tags" value="a" onChange={onChange} options={options} />);
    fireEvent.click(screen.getByRole("button"));
    // Checkboxes are rendered with role 'checkbox' by Radix; click the 'A' one to uncheck.
    const checkboxes = screen.getAllByRole("checkbox");
    const aBox = checkboxes[0]!;
    fireEvent.click(aBox);
    // Last emitted value: selected=[] → null
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
