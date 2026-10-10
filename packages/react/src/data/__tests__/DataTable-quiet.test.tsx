// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable";

type Row = { id: string; name: string };

const columns = [{ field: "name" as const, label: "Name" }];
const many: Row[] = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `Row ${i}` }));

function phone(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a quiet table", () => {
  it("offers no export when there is nothing to export", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        total={0}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable
      />,
    );
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  });

  it("sets compact rows at 40px with body-size text", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={many.slice(0, 1)}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
        density="compact"
      />,
    );
    const cell = container.querySelector("tbody td") as HTMLElement;
    expect(cell.className).toContain("fp-py-2.5");
    expect(cell.className).not.toContain("fp-text-xs");
  });

  it("shows ten cards on a phone and folds the rest behind one button", () => {
    phone(true);
    render(
      <DataTable columns={columns} rows={many} total={25} page={1} pageSize={25} rowKey="id" />,
    );
    expect(screen.queryByText("Row 9")).toBeTruthy();
    expect(screen.queryByText("Row 10")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "15 more" }));
    expect(screen.queryByText("Row 24")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "15 more" })).toBeNull();
  });

  it("moves focus to the first card it unfolds", () => {
    phone(true);
    render(
      <DataTable columns={columns} rows={many} total={25} page={1} pageSize={25} rowKey="id" />,
    );
    const more = screen.getByRole("button", { name: "15 more" });
    more.focus();
    fireEvent.click(more);
    expect(document.activeElement?.closest("li")?.textContent).toBe("Row 10");
  });

  it("keeps every row on a wide screen", () => {
    phone(false);
    render(
      <DataTable columns={columns} rows={many} total={25} page={1} pageSize={25} rowKey="id" />,
    );
    expect(screen.queryByText("Row 24")).toBeTruthy();
  });
});
