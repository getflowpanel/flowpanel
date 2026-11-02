// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/users",
}));

import { renderToString } from "react-dom/server";
import { DataTable } from "../DataTable";

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
    const { container } = render(<DataTable {...baseProps} />);
    expect(container.querySelectorAll("[data-fp-resizer]").length).toBe(0);
  });

  it("renders a resizer per column when onColumnWidthsChange is provided", () => {
    const { container } = render(
      <DataTable {...baseProps} onColumnWidthsChange={() => undefined} />,
    );
    expect(container.querySelectorAll("[data-fp-resizer]").length).toBe(2);
  });

  it("invokes onColumnWidthsChange with new width after drag", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DataTable {...baseProps} columnWidths={{ a: 120 }} onColumnWidthsChange={onChange} />,
    );
    const resizer = container.querySelector<HTMLElement>("[data-fp-resizer]")!;
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

  it("resizes and fits a focused header from the keyboard", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <DataTable
        {...baseProps}
        columns={[{ field: "a" as const, label: "A", sortable: true, textRem: 30 }]}
        columnWidths={{ a: 120 }}
        onColumnWidthsChange={onChange}
      />,
    );
    const header = getByRole("button", { name: "A" });
    expect(header.getAttribute("aria-keyshortcuts")).toContain("Shift+ArrowRight");
    fireEvent.keyDown(header, { key: "ArrowRight", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith({ a: 136 });
    expect(document.querySelector("[aria-live=polite]")?.textContent).toBe("A, 136 px");
    fireEvent.keyDown(header, { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith({ a: 120 });
    fireEvent.keyDown(header, { key: "Enter", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith({ a: (30 + 2.5) * 16 });
  });

  it("gives a cell that can be cut its full text in the server render", () => {
    const long = "alexandra.montgomerywhitfield0@gmail.com";
    const html = renderToString(
      <DataTable
        {...baseProps}
        columns={[
          { field: "a" as const, label: "A", content: "email", textRem: 20 },
          { field: "b" as const, label: "B", textRem: 2 },
        ]}
        rows={[{ id: "1", a: long, b: "ok" }]}
      />,
    );
    expect(html).toContain(`title="${long}"`);
    expect(html).not.toContain('title="ok"');
  });
});
