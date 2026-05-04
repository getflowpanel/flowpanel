// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagFilter } from "../TagFilter.js";

afterEach(() => cleanup());

describe("TagFilter", () => {
  it("emits trimmed value on blur", () => {
    const onChange = vi.fn();
    render(<TagFilter field="tags" value={null} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "x,y" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("x,y");
  });

  it("emits null when blurred with empty value", () => {
    const onChange = vi.fn();
    render(<TagFilter field="tags" value="a,b" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
