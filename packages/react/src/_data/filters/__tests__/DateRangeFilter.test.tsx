// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateRangeFilter } from "../DateRangeFilter.js";

afterEach(() => cleanup());

describe("DateRangeFilter", () => {
  it("emits 'YYYY-MM-DD:' when From changes", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter field="created" value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-01-01" },
    });
    expect(onChange).toHaveBeenCalledWith("2026-01-01:");
  });

  it("emits null when both sides are empty", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter field="created" value="2026-01-01:" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
