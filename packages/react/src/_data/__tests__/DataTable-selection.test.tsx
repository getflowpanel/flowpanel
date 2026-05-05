// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "../DataTable.js";

afterEach(cleanup);

describe("DataTable selection", () => {
  const baseProps = {
    columns: [{ field: "name" as const }],
    rows: [
      { id: "1", name: "a" },
      { id: "2", name: "b" },
    ],
    rowKey: "id" as const,
    total: 2,
    page: 1,
    pageSize: 10,
  };

  it("renders no checkbox column when onSelectionChange is absent", () => {
    render(<DataTable {...baseProps} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("renders header + N row checkboxes when selection is enabled", () => {
    const onSelectionChange = vi.fn();
    render(<DataTable {...baseProps} selection={[]} onSelectionChange={onSelectionChange} />);
    // 1 header + 2 rows = 3 checkboxes
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("toggling a row checkbox emits the new selection set", () => {
    const onSelectionChange = vi.fn();
    render(<DataTable {...baseProps} selection={[]} onSelectionChange={onSelectionChange} />);
    const [, firstRow, secondRow] = screen.getAllByRole("checkbox");
    fireEvent.click(firstRow!);
    expect(onSelectionChange).toHaveBeenLastCalledWith(["1"]);
    fireEvent.click(secondRow!);
    // onSelectionChange is called with the new set; controlling test manages selection
    expect(onSelectionChange).toHaveBeenLastCalledWith(["2"]);
  });

  it("header 'select all' when unchecked selects every row", () => {
    const onSelectionChange = vi.fn();
    render(<DataTable {...baseProps} selection={[]} onSelectionChange={onSelectionChange} />);
    const [header] = screen.getAllByRole("checkbox");
    fireEvent.click(header!);
    expect(onSelectionChange).toHaveBeenLastCalledWith(["1", "2"]);
  });

  it("header 'select all' when all selected clears the selection", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable {...baseProps} selection={["1", "2"]} onSelectionChange={onSelectionChange} />,
    );
    const [header] = screen.getAllByRole("checkbox");
    fireEvent.click(header!);
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("selected row has aria-selected='true'", () => {
    render(<DataTable {...baseProps} selection={["1"]} onSelectionChange={vi.fn()} />);
    const rows = screen.getAllByRole("row");
    // first role=row is the thead row; row index 1 is the first tbody row
    expect(rows[1]?.getAttribute("aria-selected")).toBe("true");
    expect(rows[2]?.getAttribute("aria-selected")).toBe("false");
  });
});
