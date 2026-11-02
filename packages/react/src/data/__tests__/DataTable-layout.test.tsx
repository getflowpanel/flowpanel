// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { layoutColumns } from "../column-sizing";
import { DataTable } from "../DataTable";

afterEach(cleanup);

type Customer = {
  id: string;
  company: string | null;
  plan: string;
  joined: string;
  seats: number;
  customerId: string;
};

const rows: Customer[] = [
  {
    id: "1",
    company: "Northwind",
    plan: "pro",
    joined: "2026-10-01T10:00:00Z",
    seats: 4,
    customerId: "7",
  },
  {
    id: "2",
    company: null,
    plan: "free",
    joined: "2026-10-02T10:00:00Z",
    seats: 1,
    customerId: "8",
  },
];

const columns = [
  { field: "company" as const },
  { field: "plan" as const, format: "badge" as const },
  { field: "joined" as const, type: "date" as const },
  { field: "seats" as const, type: "number" as const },
  { field: "customerId" as const, type: "reference" as const },
];

const props = { columns, rows, rowKey: "id" as const, total: 2, page: 1, pageSize: 20 };

function headerCell(name: string): HTMLElement {
  const cell = screen.getAllByRole("columnheader").find((th) => th.textContent?.trim() === name);
  if (!cell) throw new Error(`no header ${name}`);
  return cell;
}

describe("DataTable layout", () => {
  it("sizes columns by what they hold, so new rows never move them", () => {
    render(<DataTable {...props} />);
    expect(screen.getByRole("table").className).toContain("fp-table-fixed");
    const { widths, minWidth } = layoutColumns(columns);
    for (const [name, field] of [
      ["Plan", "plan"],
      ["Joined", "joined"],
      ["Seats", "seats"],
      ["Company", "company"],
    ] as const) {
      expect(headerCell(name).style.width).toBe(widths.get(field));
    }
    expect(screen.getByRole("table").style.minWidth).toBe(minWidth);
  });

  it("gives the loading skeleton the loaded table's widths, so no column moves when rows arrive", () => {
    const { unmount } = render(<DataTable {...props} loading />);
    const loading = screen.getAllByRole("columnheader").map((th) => th.style.width);
    unmount();
    render(<DataTable {...props} />);
    const loaded = screen.getAllByRole("columnheader").map((th) => th.style.width);
    expect(loading).toEqual(loaded);
  });

  it("names a reference column after the record it points to", () => {
    render(<DataTable {...props} />);
    expect(headerCell("Customer")).toBeTruthy();
  });

  it("keeps the first column in view and lets cells run their text's own direction", () => {
    render(<DataTable {...props} />);
    expect(headerCell("Company").className).toContain("fp-sticky");
    const cells = screen.getAllByRole("cell");
    expect(cells.every((td) => td.getAttribute("dir") === "auto")).toBe(true);
    expect(cells[0]?.className).toContain("fp-sticky");
    expect(cells[0]?.className).toContain("fp-whitespace-nowrap");
  });

  it("shows an empty value as a dash", () => {
    render(<DataTable {...props} />);
    const emptyCompany = screen.getAllByRole("row")[2]?.querySelector("td");
    expect(emptyCompany?.textContent).toBe("—");
  });

  it("reads 'mixed' on select-all while only some rows are selected", () => {
    render(<DataTable {...props} selection={["1"]} onSelectionChange={() => {}} />);
    const [selectAll] = screen.getAllByRole("checkbox");
    expect(selectAll?.getAttribute("aria-checked")).toBe("mixed");
  });

  it("moves the keyboard cursor to the row that takes focus", () => {
    render(<DataTable {...props} onRowClick={() => {}} />);
    const second = screen.getAllByRole("row")[2];
    if (!second) throw new Error("no second row");
    fireEvent.focus(second);
    expect(second.getAttribute("aria-current")).toBe("true");
  });

  it("offers the shortcut hint only where a shortcut sheet is mounted", () => {
    render(<DataTable {...props} onRowClick={() => {}} />);
    expect(screen.queryByText(/keyboard shortcuts/)).toBeNull();
  });
});
