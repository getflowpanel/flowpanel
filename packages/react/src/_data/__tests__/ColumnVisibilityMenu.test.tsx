// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColumnVisibilityMenu } from "../ColumnVisibilityMenu.js";

afterEach(cleanup);

describe("ColumnVisibilityMenu", () => {
  const columns = [
    { field: "email", label: "Email" },
    { field: "plan", label: "Plan" },
  ];

  it("opens the menu and lists checkboxitems for each column", async () => {
    render(<ColumnVisibilityMenu columns={columns} visibility={{}} onChange={vi.fn()} />);
    // Radix menu opens via keydown(Enter) on the trigger under happy-dom.
    fireEvent.keyDown(screen.getByRole("button", { name: /columns/i }), { key: "Enter" });
    expect(await screen.findByRole("menuitemcheckbox", { name: /email/i })).toBeTruthy();
    expect(screen.getByRole("menuitemcheckbox", { name: /plan/i })).toBeTruthy();
  });

  it("toggling a column emits onChange with the inverted flag", async () => {
    const onChange = vi.fn();
    render(
      <ColumnVisibilityMenu
        columns={columns}
        visibility={{ email: true, plan: true }}
        onChange={onChange}
      />,
    );
    // Radix menu opens via keydown(Enter) on the trigger under happy-dom.
    fireEvent.keyDown(screen.getByRole("button", { name: /columns/i }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /email/i }));
    expect(onChange).toHaveBeenCalledWith({ email: false, plan: true });
  });

  it("respects defaulted-true visibility for columns missing from the map", async () => {
    const onChange = vi.fn();
    render(<ColumnVisibilityMenu columns={columns} visibility={{}} onChange={onChange} />);
    // Radix menu opens via keydown(Enter) on the trigger under happy-dom.
    fireEvent.keyDown(screen.getByRole("button", { name: /columns/i }), { key: "Enter" });
    const emailItem = await screen.findByRole("menuitemcheckbox", { name: /email/i });
    expect(emailItem.getAttribute("aria-checked")).toBe("true");
  });
});
