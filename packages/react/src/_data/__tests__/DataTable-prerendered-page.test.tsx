// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { DataTable } from "../DataTable";

afterEach(() => cleanup());

describe("prerendered cells past the first page", () => {
  it("renders the current page's cells, not the ones a first page would hold", () => {
    render(
      <DataTable
        columns={[{ field: "name", label: "Name" }]}
        rows={[
          { id: "3", name: "Cy" },
          { id: "4", name: "Di" },
        ]}
        total={4}
        page={2}
        pageSize={2}
        rowKey="id"
        prerenderedCells={[[<b key="c">Cy rendered</b>], [<b key="d">Di rendered</b>]]}
      />,
    );
    expect(screen.getByText("Cy rendered")).toBeTruthy();
    expect(screen.getByText("Di rendered")).toBeTruthy();
    expect(screen.getAllByRole("row")[1]?.getAttribute("aria-rowindex")).toBe("4");
  });
});
