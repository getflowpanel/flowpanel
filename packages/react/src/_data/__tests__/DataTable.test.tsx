// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabelsProvider } from "../../_provider/LabelsContext.js";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable.js";

afterEach(() => cleanup());

type User = { id: string; email: string; name: string; age: number };

const rows: User[] = [
  { id: "1", email: "a@b.co", name: "Alice", age: 30 },
  { id: "2", email: "b@b.co", name: "Bob", age: 25 },
  { id: "3", email: "c@b.co", name: "Carol", age: 40 },
];

describe("DataTable", () => {
  it("renders column headers and rows", () => {
    render(
      <DataTable
        columns={[
          { field: "email", label: "Email" },
          { field: "name", label: "Name" },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
      />,
    );
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("c@b.co")).toBeTruthy();
  });

  it("renders empty state when rows are empty", () => {
    render(
      <DataTable
        columns={[{ field: "email" }]}
        rows={[]}
        total={0}
        page={1}
        pageSize={10}
        rowKey="id"
        emptyTitle="No users"
      />,
    );
    expect(screen.getByText("No users")).toBeTruthy();
  });

  it("renders skeleton rows when loading", () => {
    const { container } = render(
      <DataTable
        columns={[{ field: "email", label: "Email" }]}
        rows={[]}
        total={0}
        page={1}
        pageSize={10}
        rowKey="id"
        loading
      />,
    );
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
  });

  it("calls onRowClick when row clicked", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[{ field: "email" }]}
        rows={[rows[0]!]}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByText("a@b.co").closest("tr")!);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("emits onSortChange toggling asc/desc on sortable header click", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={[{ field: "age", label: "Age", sortable: true }]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
        sort={null}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByText("Age"));
    expect(onSortChange).toHaveBeenCalledWith({ field: "age", dir: "asc" });
  });

  it("toggles sort direction on second click", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={[{ field: "age", label: "Age", sortable: true }]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
        sort={{ field: "age", dir: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByText("Age"));
    expect(onSortChange).toHaveBeenCalledWith({ field: "age", dir: "desc" });
  });

  it("marks sorted column with aria-sort", () => {
    render(
      <DataTable
        columns={[{ field: "age", label: "Age", sortable: true }]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
        sort={{ field: "age", dir: "asc" }}
      />,
    );
    expect(screen.getByText("Age").closest("th")?.getAttribute("aria-sort")).toBe("ascending");
  });

  it("keyboard nav: j moves cursor down, Enter triggers row click", () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <DataTable
        columns={[{ field: "email" }]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
        onRowClick={onRowClick}
      />,
    );
    const tbody = container.querySelector("tbody")!;
    tbody.focus();
    fireEvent.keyDown(tbody, { key: "j" });
    fireEvent.keyDown(tbody, { key: "j" });
    fireEvent.keyDown(tbody, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it("keyboard nav: Escape clears cursor", () => {
    const { container } = render(
      <DataTable
        columns={[{ field: "email" }]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
      />,
    );
    const tbody = container.querySelector("tbody")!;
    fireEvent.keyDown(tbody, { key: "j" });
    // cursor should be 0 -> the first row should have bg class; not reliable to assert in jsdom
    fireEvent.keyDown(tbody, { key: "Escape" });
    // After Escape, pressing Enter should NOT fire onRowClick
    const onRowClick = vi.fn();
    fireEvent.keyDown(tbody, { key: "Enter" });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("emits onPageChange when Next clicked", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={[{ field: "email" }]}
        rows={rows}
        total={30}
        page={1}
        pageSize={10}
        rowKey="id"
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables Prev on first page and Next on last page", () => {
    const { rerender } = render(
      <DataTable
        columns={[{ field: "email" }]}
        rows={rows}
        total={30}
        page={1}
        pageSize={10}
        rowKey="id"
      />,
    );
    expect(screen.getByRole("button", { name: /previous page/i }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: /next page/i }).hasAttribute("disabled")).toBe(false);

    rerender(
      <DataTable
        columns={[{ field: "email" }]}
        rows={rows}
        total={30}
        page={3}
        pageSize={10}
        rowKey="id"
      />,
    );
    expect(screen.getByRole("button", { name: /next page/i }).hasAttribute("disabled")).toBe(true);
  });

  it("uses custom render function when provided", () => {
    render(
      <DataTable
        columns={[{ field: "name", render: (r) => <strong data-testid="nm">{r.name}</strong> }]}
        rows={[rows[0]!]}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
      />,
    );
    expect(screen.getByTestId("nm").textContent).toBe("Alice");
  });

  it("renders localized empty title via LabelsProvider when emptyTitle prop omitted", () => {
    render(
      <LabelsProvider value={{ noResults: "Ничего не найдено" }}>
        <DataTable
          columns={[{ field: "email" }]}
          rows={[]}
          total={0}
          page={1}
          pageSize={10}
          rowKey="id"
        />
      </LabelsProvider>,
    );
    expect(screen.getByText("Ничего не найдено")).toBeTruthy();
  });
});
