// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/users",
}));

import { DataTable } from "../DataTable.js";

afterEach(cleanup);

describe("DataTable column pin", () => {
  const baseProps = {
    columns: [
      { field: "a" as const, label: "A" },
      { field: "b" as const, label: "B" },
      { field: "c" as const, label: "C" },
    ],
    rows: [{ id: "1", a: 1, b: 2, c: 3 }],
    rowKey: "id" as const,
    total: 1,
    page: 1,
    pageSize: 10,
  };

  it("reorders columns: left pins first, right pins last, rest in middle", () => {
    const { container } = render(
      <DataTable
        {...baseProps}
        pinnedColumns={{ left: ["c"], right: ["a"] }}
        onPinnedColumnsChange={() => undefined}
      />,
    );
    const headers = Array.from(container.querySelectorAll("thead th")).map(
      (th) => th.textContent?.trim() ?? "",
    );
    // Order should be: C (left), B (middle), A (right).
    // Account for leading selection/header cells by filtering to labels that start with A/B/C.
    const labelOrder = headers
      .map((h) => h.charAt(0))
      .filter((ch) => ch === "A" || ch === "B" || ch === "C");
    expect(labelOrder).toEqual(["C", "B", "A"]);
  });

  it("does not show pin menu when onPinnedColumnsChange is absent", () => {
    render(<DataTable {...baseProps} />);
    expect(screen.queryAllByRole("button", { name: /column options/i }).length).toBe(0);
  });

  it("calls onPinnedColumnsChange when 'Pin left' is selected", async () => {
    const onChange = vi.fn();
    render(<DataTable {...baseProps} onPinnedColumnsChange={onChange} />);
    const trigger = screen.getAllByRole("button", { name: /column options for a/i })[0]!;
    // Radix DropdownMenu needs keyboard to open in happy-dom
    fireEvent.keyDown(trigger, { key: "Enter" });
    const pinLeft = await screen.findByRole("menuitem", { name: /pin left/i });
    fireEvent.click(pinLeft);
    expect(onChange).toHaveBeenCalledWith({ left: ["a"], right: [] });
  });
});
