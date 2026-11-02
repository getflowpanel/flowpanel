// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable";

afterEach(cleanup);

// The inline editor loads on first use; load it once so each test below renders it at once.
beforeAll(async () => {
  render(
    <DataTable
      columns={[{ field: "name", editable: true }]}
      rows={[{ id: "1", name: "a" }]}
      rowKey="id"
      total={1}
      page={1}
      pageSize={10}
      inlineEditResource="user"
    />,
  );
  await screen.findByRole("button", { name: /Edit Name$/ });
  cleanup();
});

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

function rowBody(): HTMLElement {
  return document.querySelector("tbody") as HTMLElement;
}

describe("keyboard row activation", () => {
  it("opens the first row on Enter as soon as the table is focused", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...baseProps} onRowClick={onRowClick} />);
    const body = rowBody();
    fireEvent.focus(body);
    fireEvent.keyDown(body, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(baseProps.rows[0]);
  });

  it("moves with arrows and with j / k", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...baseProps} onRowClick={onRowClick} />);
    const body = rowBody();
    fireEvent.focus(body);
    fireEvent.keyDown(body, { key: "ArrowDown" });
    fireEvent.keyDown(body, { key: "Enter" });
    expect(onRowClick).toHaveBeenLastCalledWith(baseProps.rows[1]);
    fireEvent.keyDown(body, { key: "k" });
    fireEvent.keyDown(body, { key: "Enter" });
    expect(onRowClick).toHaveBeenLastCalledWith(baseProps.rows[0]);
  });

  it("keeps the cursor where it was when focus returns", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...baseProps} onRowClick={onRowClick} />);
    const body = rowBody();
    fireEvent.focus(body);
    fireEvent.keyDown(body, { key: "ArrowDown" });
    fireEvent.blur(body);
    fireEvent.focus(body);
    fireEvent.keyDown(body, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(baseProps.rows[1]);
  });

  it("names the rows region so the shortcuts are discoverable", () => {
    render(<DataTable {...baseProps} onRowClick={vi.fn()} />);
    expect(rowBody().getAttribute("aria-label")).toMatch(/Enter opens/);
  });

  it("uses the styled checkbox, not the browser's native control", () => {
    render(<DataTable {...baseProps} onSelectionChange={vi.fn()} selection={[]} />);
    const box = screen.getByRole("checkbox", { name: /select row 1/i });
    expect(box.tagName).toBe("BUTTON");
    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });
});

describe("an editable cell", () => {
  const editable = {
    ...baseProps,
    columns: [{ field: "name" as const, editable: true }],
    inlineEditResource: "users",
  };
  const editButtons = () => screen.getAllByRole("button", { name: /Edit Name$/ });
  const editing = () => screen.queryByDisplayValue("a") !== null;

  it.each([
    ["a clickable row", true],
    ["a row that does not open", false],
  ])("offers one edit button per cell in %s", (_name, clickable) => {
    render(<DataTable {...editable} {...(clickable ? { onRowClick: vi.fn() } : {})} />);
    expect(editButtons()).toHaveLength(baseProps.rows.length);
    for (const row of document.querySelectorAll<HTMLElement>("tbody tr")) {
      expect(within(row).getAllByRole("button", { name: /Edit Name$/ })).toHaveLength(1);
    }
  });

  it("opens a clickable row from a pointer click on the value", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...editable} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("a"), { detail: 1 });
    expect(onRowClick).toHaveBeenCalledWith(baseProps.rows[0]);
    expect(editing()).toBe(false);
  });

  it("opens a clickable row on a real double click and does not edit", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...editable} onRowClick={onRowClick} />);
    const value = screen.getByText("a");
    fireEvent.click(value, { detail: 1 });
    fireEvent.click(value, { detail: 2 });
    fireEvent.doubleClick(value, { detail: 2 });
    expect(onRowClick).toHaveBeenCalledWith(baseProps.rows[0]);
    expect(editing()).toBe(false);
  });

  it("edits a clickable row's cell from the pencil without opening the row", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...editable} onRowClick={onRowClick} />);
    fireEvent.click(editButtons()[0] as HTMLElement, { detail: 1 });
    expect(editing()).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("edits on Enter on the pencil instead of opening the record", () => {
    const onRowClick = vi.fn();
    render(<DataTable {...editable} onRowClick={onRowClick} />);
    const pencil = editButtons()[0] as HTMLElement;
    fireEvent.focus(rowBody());
    pencil.focus();
    fireEvent.keyDown(pencil, { key: "Enter" });
    expect(editing()).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("edits on a single pointer click when the row does not open", () => {
    render(<DataTable {...editable} />);
    fireEvent.click(editButtons()[0] as HTMLElement, { detail: 1 });
    expect(editing()).toBe(true);
  });

  it("shows the pencil on row hover", () => {
    render(<DataTable {...editable} onRowClick={vi.fn()} />);
    const pencil = editButtons()[0] as HTMLElement;
    expect(pencil.closest("tr")?.className).toContain("fp-group/row");
    expect(pencil.className).toContain("group-hover/row:fp-opacity-100");
    expect(pencil.className).toContain("group-focus-within/edit:fp-opacity-100");
  });
});
