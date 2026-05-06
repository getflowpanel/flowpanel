// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagInput } from "../TagInput.js";

afterEach(cleanup);

describe("TagInput", () => {
  it("renders existing tags", () => {
    render(<TagInput value={["red", "blue"]} onChange={vi.fn()} />);
    expect(screen.getByText("red")).toBeTruthy();
    expect(screen.getByText("blue")).toBeTruthy();
  });

  it("adds a tag on Enter and clears the input", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "foo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["foo"]);
  });

  it("does not add a duplicate tag", () => {
    const onChange = vi.fn();
    render(<TagInput value={["foo"]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "foo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes tag on X click", () => {
    const onChange = vi.fn();
    render(<TagInput value={["foo", "bar"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove foo/i }));
    expect(onChange).toHaveBeenCalledWith(["bar"]);
  });

  it("respects max cap", () => {
    const onChange = vi.fn();
    render(<TagInput value={["a", "b"]} onChange={onChange} max={2} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
