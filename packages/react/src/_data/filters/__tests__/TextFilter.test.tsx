// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextFilter } from "../TextFilter";

afterEach(() => cleanup());

describe("TextFilter", () => {
  it("debounces onChange", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { getByRole } = render(<TextFilter value={null} onChange={onChange} />);
    fireEvent.change(getByRole("textbox"), { target: { value: "abc" } });
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(350);
    expect(onChange).toHaveBeenCalledWith("abc");
    vi.useRealTimers();
  });

  it("does not echo a value that arrived from the parent", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { getByRole, rerender } = render(<TextFilter value={null} onChange={onChange} />);
    fireEvent.change(getByRole("textbox"), { target: { value: "abc" } });
    await vi.advanceTimersByTimeAsync(350);
    expect(onChange).toHaveBeenCalledWith("abc");
    // The parent accepts the commit, so the prop catches up with the input.
    rerender(<TextFilter value="abc" onChange={onChange} />);
    await vi.advanceTimersByTimeAsync(350);
    onChange.mockClear();
    // Clear-filters (or a restored view) then resets the prop from outside.
    rerender(<TextFilter value={null} onChange={onChange} />);
    expect((getByRole("textbox") as HTMLInputElement).value).toBe("");
    await vi.advanceTimersByTimeAsync(350);
    expect(onChange).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("emits null when cleared", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { getByRole } = render(<TextFilter value="abc" onChange={onChange} />);
    fireEvent.change(getByRole("textbox"), { target: { value: "" } });
    await vi.advanceTimersByTimeAsync(350);
    expect(onChange).toHaveBeenCalledWith(null);
    vi.useRealTimers();
  });
});
