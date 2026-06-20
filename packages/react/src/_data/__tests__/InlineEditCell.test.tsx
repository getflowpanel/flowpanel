// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { InlineEditCell } from "../InlineEditCell.js";

afterEach(cleanup);

describe("InlineEditCell", () => {
  it("stops single-click propagation so a wrapping row-click handler doesn't fire", () => {
    // Regression: the runtime always wires a drawer row-click handler on
    // the <tr>. Without stopPropagation the first click of a double-click
    // opens the drawer before edit mode is ever reachable.
    const onRowClick = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test harness stands in for DataTableRow's <tr onClick>.
      // biome-ignore lint/a11y/useKeyWithClickEvents: same — mirrors the real <tr>, which is also click-only.
      <div onClick={onRowClick}>
        <InlineEditCell resource="users" id="1" field="name" value="Alice" />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /double-click to edit name/i }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("double-click still enters edit mode", () => {
    render(<InlineEditCell resource="users" id="1" field="name" value="Alice" />);
    const cell = screen.getByRole("button", { name: /double-click to edit name/i });
    fireEvent.doubleClick(cell);
    expect(screen.getByDisplayValue("Alice")).toBeTruthy();
  });
});
