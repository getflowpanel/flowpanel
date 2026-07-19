// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateRangeFilter } from "../DateRangeFilter.js";

afterEach(() => cleanup());

// Every assertion below is relative to "today", so pin it.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 12, 9, 0, 0)); // 2026-08-12, local
});
afterEach(() => vi.useRealTimers());

const openPicker = () => fireEvent.click(screen.getByRole("button", { name: /^date range$/i }));

/** Day cells are labelled with the locale's long date, e.g. "August 5, 2026". */
const day = (label: string) => screen.getAllByRole("button", { name: label })[0] as HTMLElement;

describe("DateRangeFilter", () => {
  it("emits 'from:to' after picking both ends", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter field="created" value={null} onChange={onChange} />);
    openPicker();
    fireEvent.click(day("August 5, 2026"));
    expect(onChange).not.toHaveBeenCalled(); // half-open range must not commit
    fireEvent.click(day("August 20, 2026"));
    expect(onChange).toHaveBeenCalledWith("2026-08-05:2026-08-20");
  });

  it("normalizes a backwards selection instead of emitting an inverted range", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter field="created" value={null} onChange={onChange} />);
    openPicker();
    fireEvent.click(day("August 20, 2026"));
    fireEvent.click(day("August 5, 2026"));
    expect(onChange).toHaveBeenCalledWith("2026-08-05:2026-08-20");
  });

  it("emits local calendar dates, not UTC-shifted ones", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter field="created" value={null} onChange={onChange} />);
    openPicker();
    fireEvent.click(day("August 1, 2026"));
    fireEvent.click(day("August 1, 2026"));
    // A toISOString()-based encoder would report 2026-07-31 west of UTC.
    expect(onChange).toHaveBeenCalledWith("2026-08-01:2026-08-01");
  });

  it("applies a preset in one click", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter field="created" value={null} onChange={onChange} />);
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(onChange).toHaveBeenCalledWith("2026-08-06:2026-08-12");
  });

  it("emits null when the range is cleared", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter field="created" value="2026-08-05:2026-08-20" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /clear date range/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders a committed range on the trigger", () => {
    render(<DateRangeFilter field="created" value="2026-08-05:2026-08-20" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^date range$/i }).textContent).toContain("Aug 5");
    expect(screen.getByRole("button", { name: /^date range$/i }).textContent).toContain("Aug 20");
  });

  it("keeps a one-sided range round-tripping through the wire format", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter field="created" value="2026-08-05:" onChange={onChange} />);
    expect(screen.getByRole("button", { name: /^date range$/i }).textContent).toContain(
      "From Aug 5",
    );
  });

  it("moves the day cursor with the arrow keys", () => {
    render(<DateRangeFilter field="created" value="2026-08-12:2026-08-12" onChange={vi.fn()} />);
    openPicker();
    const start = day("August 12, 2026");
    expect(start.tabIndex).toBe(0);
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(day("August 13, 2026").tabIndex).toBe(0);
    fireEvent.keyDown(day("August 13, 2026"), { key: "ArrowDown" });
    expect(day("August 20, 2026").tabIndex).toBe(0);
  });
});
