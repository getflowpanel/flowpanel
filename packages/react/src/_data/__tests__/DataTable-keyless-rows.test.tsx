// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable";
import { MobileCardList } from "../MobileCardList";

afterEach(cleanup);

/** A projection that could not include the key column, next to one that could. */
const rows = [{ id: "u1", name: "a" }, { name: "b" }] as Array<Record<string, unknown>>;

const baseProps = {
  columns: [{ field: "name" }],
  rows,
  rowKey: "id",
  total: 2,
  page: 1,
  pageSize: 10,
};

describe("rows the projection could not identify", () => {
  it("offers no selection checkbox for a row with no identifier", () => {
    const onSelectionChange = vi.fn();
    render(<DataTable {...baseProps} selection={[]} onSelectionChange={onSelectionChange} />);
    const boxes = screen.getAllByRole("checkbox");
    // header + both rows render; only the identified row's box can be used.
    expect(boxes).toHaveLength(3);
    expect((boxes[2] as HTMLElement).getAttribute("disabled")).not.toBeNull();
    fireEvent.click(boxes[2] as HTMLElement);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("selects every row it can identify, and no placeholder, when selecting all", () => {
    const onSelectionChange = vi.fn();
    render(<DataTable {...baseProps} selection={[]} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0] as HTMLElement);
    expect(onSelectionChange).toHaveBeenCalledWith(["u1"]);
  });

  it("does not activate a row it cannot address", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...baseProps} onRowClick={onRowClick} />);
    const cells = screen.getAllByText(/^[ab]$/);
    fireEvent.click(cells[0] as HTMLElement);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    fireEvent.click(cells[1] as HTMLElement);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("keeps a literal 'undefined' identifier addressable", () => {
    const onRowClick = vi.fn();
    const literal: Array<Record<string, unknown>> = [{ id: "undefined", name: "a" }];
    render(<DataTable {...baseProps} rows={literal} total={1} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("a"));
    expect(onRowClick).toHaveBeenCalledWith({ id: "undefined", name: "a" });
  });

  it("renders no inline editor on a row with no identifier", () => {
    render(
      <DataTable
        {...baseProps}
        columns={[{ field: "name", editable: true }]}
        inlineEditResource="user"
      />,
    );
    // One editable cell becomes a button; the keyless row stays plain text.
    expect(screen.getAllByRole("button", { name: /a/ })).toHaveLength(1);
    expect(screen.queryAllByRole("button", { name: /^b$/ })).toHaveLength(0);
  });

  it("does not run a keyboard shortcut on a row it cannot address", () => {
    const onEditRow = vi.fn();
    const onDeleteRow = vi.fn();
    render(<DataTable {...baseProps} onEditRow={onEditRow} onDeleteRow={onDeleteRow} />);
    const body = screen.getAllByRole("rowgroup")[1] as HTMLElement;
    fireEvent.keyDown(body, { key: "j" });
    fireEvent.keyDown(body, { key: "e" });
    fireEvent.keyDown(body, { key: "d" });
    expect(onEditRow).toHaveBeenCalledTimes(1);
    expect(onDeleteRow).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(body, { key: "j" });
    fireEvent.keyDown(body, { key: "e" });
    fireEvent.keyDown(body, { key: "d" });
    expect(onEditRow).toHaveBeenCalledTimes(1);
    expect(onDeleteRow).toHaveBeenCalledTimes(1);
  });

  it("applies the same rule to the mobile card list", () => {
    const onRowClick = vi.fn();
    const onSelectionChange = vi.fn();
    render(
      <MobileCardList
        columns={[{ field: "name" }]}
        rows={rows}
        rowKey="id"
        onRowClick={onRowClick}
        selection={[]}
        onSelectionChange={onSelectionChange}
      />,
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect((boxes[1] as HTMLElement).getAttribute("disabled")).not.toBeNull();
    const openable = screen.getAllByRole("button");
    expect(openable).toHaveLength(1);
  });
});
