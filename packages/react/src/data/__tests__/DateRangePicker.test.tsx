// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "../DateRangePicker";

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

  it("offers only the given presets, in order, and shows the first when none is picked", () => {
    render(<DateRangePicker value={{}} onChange={() => {}} presets={["today", "yesterday"]} />);
    const trigger = screen.getByRole("button");
    expect(trigger.textContent).toBe("Today");
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Today",
      "Yesterday",
    ]);
  });

  it("shows a custom range as its two days instead of a preset", () => {
    render(
      <DateRangePicker
        value={{ from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-07T00:00:00Z") }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button").textContent).toBe("2026-09-01 – 2026-09-07");
  });
});
