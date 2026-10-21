// @vitest-environment happy-dom

import { resolveFormatting } from "@flowpanel/core/format";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FormattingProvider } from "../../../provider/FormattingContext";
import { LabelsProvider } from "../../../provider/LabelsContext";
import { DateRangeFilter } from "../DateRangeFilter";

afterEach(() => cleanup());

// Every assertion below is relative to "today", so pin it.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 12, 9, 0, 0)); // 2026-08-12, local
});
afterEach(() => vi.useRealTimers());

const openPicker = () => fireEvent.click(screen.getByRole("button", { name: /, date range$/i }));

/** Day cells are labelled with the locale's long date, e.g. "August 5, 2026". */
const day = (label: string) => screen.getAllByRole("button", { name: label })[0] as HTMLElement;

describe("DateRangeFilter", () => {
  it("keeps preset identity when different presets have the same translation", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = vi.fn();
    try {
      render(
        <LabelsProvider value={{ dateRange: { today: "Период", last7d: "Период" } }}>
          <DateRangeFilter value={null} onChange={onChange} />
        </LabelsProvider>,
      );
      openPicker();
      fireEvent.click(screen.getAllByRole("button", { name: "Период" })[0] as HTMLElement);
      expect(onChange).toHaveBeenLastCalledWith("2026-08-12:2026-08-12");
      openPicker();
      fireEvent.click(screen.getAllByRole("button", { name: "Период" })[1] as HTMLElement);
      expect(onChange).toHaveBeenLastCalledWith("2026-08-06:2026-08-12");
      expect(error.mock.calls.some((args) => args.join(" ").includes("same key"))).toBe(false);
    } finally {
      error.mockRestore();
    }
  });
  it("keeps the actual mobile trigger at least 44px tall", () => {
    render(<DateRangeFilter value={null} onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /, date range$/i });
    expect(trigger.className).toContain("fp-h-11");
    expect(trigger.className).toContain("sm:fp-h-8");
  });

  it("keeps the mobile clear action at least 44px square", () => {
    render(<DateRangeFilter value="2026-08-05:2026-08-20" onChange={vi.fn()} />);

    const clear = screen.getByRole("button", { name: /clear date range/i });
    expect(clear.className).toContain("fp-h-11");
    expect(clear.className).toContain("fp-w-11");
    expect(clear.className).toContain("sm:fp-h-6");
    expect(clear.className).toContain("sm:fp-w-6");
  });

  it("emits 'from:to' after picking both ends", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={null} onChange={onChange} />);
    openPicker();
    fireEvent.click(day("August 5, 2026"));
    expect(onChange).not.toHaveBeenCalled(); // half-open range must not commit
    fireEvent.click(day("August 20, 2026"));
    expect(onChange).toHaveBeenCalledWith("2026-08-05:2026-08-20");
  });

  it("normalizes a backwards selection instead of emitting an inverted range", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={null} onChange={onChange} />);
    openPicker();
    fireEvent.click(day("August 20, 2026"));
    fireEvent.click(day("August 5, 2026"));
    expect(onChange).toHaveBeenCalledWith("2026-08-05:2026-08-20");
  });

  it("emits local calendar dates, not UTC-shifted ones", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={null} onChange={onChange} />);
    openPicker();
    fireEvent.click(day("August 1, 2026"));
    fireEvent.click(day("August 1, 2026"));
    // A toISOString()-based encoder would report 2026-07-31 west of UTC.
    expect(onChange).toHaveBeenCalledWith("2026-08-01:2026-08-01");
  });

  it("applies a preset in one click", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={null} onChange={onChange} />);
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(onChange).toHaveBeenCalledWith("2026-08-06:2026-08-12");
  });

  it("emits null when the range is cleared", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value="2026-08-05:2026-08-20" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /clear date range/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders a committed range on the trigger", () => {
    render(<DateRangeFilter value="2026-08-05:2026-08-20" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /, date range$/i }).textContent).toContain("Aug 5");
    expect(screen.getByRole("button", { name: /, date range$/i }).textContent).toContain("Aug 20");
  });

  it("keeps a one-sided range round-tripping through the wire format", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value="2026-08-05:" onChange={onChange} />);
    expect(screen.getByRole("button", { name: /, date range$/i }).textContent).toContain(
      "From Aug 5",
    );
  });

  it("moves the day cursor with the arrow keys", () => {
    render(<DateRangeFilter value="2026-08-12:2026-08-12" onChange={vi.fn()} />);
    openPicker();
    const start = day("August 12, 2026");
    expect(start.tabIndex).toBe(0);
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(day("August 13, 2026").tabIndex).toBe(0);
    fireEvent.keyDown(day("August 13, 2026"), { key: "ArrowDown" });
    expect(day("August 20, 2026").tabIndex).toBe(0);
  });

  it("shows a server preset by its label, including one the picker does not offer", () => {
    render(<DateRangeFilter value="YTD" onChange={vi.fn()} />);
    expect(screen.getByText("Year to date")).toBeTruthy();
    cleanup();
    render(<DateRangeFilter value="last7d" onChange={vi.fn()} />);
    expect(screen.getByText("Last 7 days")).toBeTruthy();
  });

  it("marks the applied server preset when the popover opens", () => {
    render(<DateRangeFilter value="last7d" onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Last 7 days"));
    const pressed = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed.map((button) => button.textContent)).toEqual(["Last 7 days"]);
  });
});

describe("DateRangeFilter's today, read in New York late in the evening", () => {
  const hostZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });
  afterAll(() => {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  });

  const today = (timeZone?: string) => {
    vi.setSystemTime(new Date("2026-08-13T03:30:00.000Z"));
    const onChange = vi.fn();
    render(
      <FormattingProvider value={resolveFormatting(timeZone ? { timeZone } : {})}>
        <DateRangeFilter value={null} onChange={onChange} />
      </FormattingProvider>,
    );
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    return onChange.mock.calls[0]?.[0];
  };

  it("is the admin's day in UTC, not the reader's", () => {
    expect(today()).toBe("2026-08-13:2026-08-13");
  });

  it("is the configured zone's day when formatting.timeZone is set", () => {
    expect(today("America/New_York")).toBe("2026-08-12:2026-08-12");
  });
});
