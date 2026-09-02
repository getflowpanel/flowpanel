// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable";

afterEach(cleanup);

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
