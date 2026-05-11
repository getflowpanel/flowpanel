// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/users",
}));

import { DataTable } from "../DataTable.js";

afterEach(cleanup);

describe("DataTable column resize", () => {
  const baseProps = {
    columns: [
      { field: "a" as const, label: "A" },
      { field: "b" as const, label: "B" },
    ],
    rows: [{ id: "1", a: 1, b: 2 }],
    rowKey: "id" as const,
    total: 1,
    page: 1,
    pageSize: 10,
  };

  it("renders no resizer handle when onColumnWidthsChange is absent", () => {
    const { queryAllByRole } = render(<DataTable {...baseProps} />);
    // separator role comes from ColumnResizer only
    expect(queryAllByRole("separator").length).toBe(0);
  });

  it("renders a resizer per column when onColumnWidthsChange is provided", () => {
    const { getAllByRole } = render(
      <DataTable {...baseProps} onColumnWidthsChange={() => undefined} />,
    );
    expect(getAllByRole("separator").length).toBe(2);
  });

  it("invokes onColumnWidthsChange with new width after drag", () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <DataTable {...baseProps} columnWidths={{ a: 120 }} onColumnWidthsChange={onChange} />,
    );
    const resizer = getAllByRole("separator")[0]!;
    // Mock setPointerCapture/releasePointerCapture (happy-dom lacks them)
    (resizer as unknown as { setPointerCapture: () => void }).setPointerCapture = () => undefined;
    (resizer as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () =>
      undefined;
    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 540, pointerId: 1 });
    fireEvent.pointerUp(resizer, { clientX: 540, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const args = onChange.mock.calls[0]![0] as Record<string, number>;
    expect(args.a).toBe(160); // 120 + 40
  });
});
