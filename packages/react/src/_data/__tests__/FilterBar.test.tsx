// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "../FilterBar.js";

afterEach(() => cleanup());

describe("FilterBar", () => {
  it("renders a filter per spec entry", () => {
    render(
      <FilterBar
        filters={[
          { field: "email", type: "text", label: "Email" },
          {
            field: "plan",
            type: "select",
            label: "Plan",
            options: [{ label: "Pro", value: "pro" }],
          },
        ]}
        values={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Plan")).toBeTruthy();
  });

  it("shows Clear button when any filter has a value AND onClear is provided; clicking calls onClear", () => {
    const onClear = vi.fn();
    render(
      <FilterBar
        filters={[
          {
            field: "plan",
            type: "select",
            label: "Plan",
            options: [{ label: "Pro", value: "pro" }],
          },
        ]}
        values={{ plan: "pro" }}
        onChange={vi.fn()}
        onClear={onClear}
      />,
    );
    const btn = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(btn);
    expect(onClear).toHaveBeenCalled();
  });

  it("does not render Clear when no values set", () => {
    render(
      <FilterBar
        filters={[{ field: "plan", type: "select", label: "Plan", options: [] }]}
        values={{}}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });
});
