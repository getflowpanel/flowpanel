// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextFilter } from "../TextFilter.js";

afterEach(() => cleanup());

describe("TextFilter", () => {
  it("debounces onChange", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { getByRole } = render(<TextFilter field="email" value={null} onChange={onChange} />);
    fireEvent.change(getByRole("textbox"), { target: { value: "abc" } });
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(350);
    expect(onChange).toHaveBeenCalledWith("abc");
    vi.useRealTimers();
  });

  it("emits null when cleared", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { getByRole } = render(<TextFilter field="email" value="abc" onChange={onChange} />);
    fireEvent.change(getByRole("textbox"), { target: { value: "" } });
    await vi.advanceTimersByTimeAsync(350);
    expect(onChange).toHaveBeenCalledWith(null);
    vi.useRealTimers();
  });
});
