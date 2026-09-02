// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { InlineEditCell } from "../InlineEditCell";

afterEach(cleanup);

describe("InlineEditCell", () => {
  it("stops single-click propagation so a wrapping row-click handler doesn't fire", () => {
    // The runtime always wires a drawer row-click handler on the <tr>;
    // without stopPropagation activating the cell also opens the drawer.
    const onRowClick = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test harness stands in for DataTableRow's <tr onClick>.
      // biome-ignore lint/a11y/useKeyWithClickEvents: same — mirrors the real <tr>, which is also click-only.
      <div onClick={onRowClick}>
        <InlineEditCell resource="users" id="1" field="name" value="Alice" />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit name/i }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("click enters edit mode, so button activation from any input device works", () => {
    render(<InlineEditCell resource="users" id="1" field="name" value="Alice" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit name" }));
    expect(screen.getByDisplayValue("Alice")).toBeTruthy();
  });

  it("names the cell after the action, not the pointer gesture", () => {
    render(<InlineEditCell resource="users" id="1" field="name" value="Alice" />);
    expect(screen.getByRole("button", { name: "Edit name" })).toBeTruthy();
  });

  it("returns focus to the cell when editing is cancelled", () => {
    render(<InlineEditCell resource="users" id="1" field="name" value="Alice" />);
    const cell = screen.getByRole("button", { name: "Edit name" });
    cell.focus();
    fireEvent.click(cell);
    const input = screen.getByDisplayValue("Alice");
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit name" }));
  });

  it("double-click still enters edit mode", () => {
    render(<InlineEditCell resource="users" id="1" field="name" value="Alice" />);
    const cell = screen.getByRole("button", { name: /edit name/i });
    fireEvent.doubleClick(cell);
    expect(screen.getByDisplayValue("Alice")).toBeTruthy();
  });

  it("Enter on the focused cell enters edit mode without bubbling to the row", () => {
    const onRowKeyDown = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test harness stands in for the keyboard-navigable <tbody>.
      <div onKeyDown={onRowKeyDown}>
        <InlineEditCell resource="users" id="1" field="name" value="Alice" />
      </div>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /edit name/i }), { key: "Enter" });
    expect(screen.getByDisplayValue("Alice")).toBeTruthy();
    expect(onRowKeyDown).not.toHaveBeenCalled();
  });
});
