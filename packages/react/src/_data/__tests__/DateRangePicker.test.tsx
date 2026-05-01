// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "../DateRangePicker.js";

afterEach(() => cleanup());

describe("DateRangePicker", () => {
  it("renders the active preset label on trigger", () => {
    render(<DateRangePicker value={{ preset: "last7d" }} onChange={() => {}} />);
    expect(screen.getByText("Last 7 days")).toBeTruthy();
  });

  it("falls back to Last 7 days when no preset provided", () => {
    render(<DateRangePicker value={{}} onChange={() => {}} />);
    expect(screen.getByText("Last 7 days")).toBeTruthy();
  });

  it("fires onChange with preset key when an item is selected", () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: "last7d" }} onChange={onChange} />);

    // Open the menu (Radix needs keydown on the trigger — Enter opens it
    // synchronously even under happy-dom).
    const trigger = screen.getByRole("button");
    fireEvent.keyDown(trigger, { key: "Enter" });

    // Click "Today" preset
    const today = screen.getByText("Today");
    fireEvent.click(today);

    expect(onChange).toHaveBeenCalledWith({ preset: "today" });
  });
});
