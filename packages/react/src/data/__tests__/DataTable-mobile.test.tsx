// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable";

type User = { id: string; email: string; name: string };

const rows: User[] = [
  { id: "1", email: "a@b.co", name: "Alice" },
  { id: "2", email: "b@b.co", name: "Bob" },
];

describe("DataTable mobile card view", () => {
  beforeEach(() => {
    // Force the card-view branch: a matching `(max-width: 639px)` query.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows card placeholders while it loads on a phone, as the loaded list does", () => {
    const { container } = render(
      <DataTable
        columns={[
          { field: "name", label: "Name" },
          { field: "email", label: "Email" },
        ]}
        rows={[]}
        total={0}
        page={1}
        pageSize={20}
        rowKey="id"
        loading
      />,
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(5);
    expect(screen.getAllByText("Email")).toHaveLength(5);
  });

  it("still renders pagination on mobile, not just the card list", () => {
    // Regression: the mobile branch used to early-return only <MobileCardList/>,
    // making rows past page 1 unreachable on a phone.
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={[{ field: "email", label: "Email" }]}
        rows={rows}
        total={30}
        page={1}
        pageSize={2}
        rowKey="id"
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeTruthy();
    const next = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(2);
    // Cards are still there too.
    expect(screen.getByText("a@b.co")).toBeTruthy();
  });

  it("still renders the toolbar (export/import/density) on mobile", () => {
    render(
      <DataTable
        columns={[{ field: "email", label: "Email" }]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable
        showDensityToggle
      />,
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  });

  it("names the file actions by their icons on a phone, so a long language never pushes them out", () => {
    render(
      <DataTable
        columns={[{ field: "email", label: "Email" }]}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable
        importable={{ resource: "users", formats: ["csv"] }}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
      />,
    );
    for (const name of ["Export", "Import", "Columns"]) {
      const button = screen.getByRole("button", { name });
      expect(button.querySelector("svg")).toBeTruthy();
      expect(button.querySelector("span.fp-hidden.sm\\:fp-inline")?.textContent).toBe(name);
    }
  });
});
