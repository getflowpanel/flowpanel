// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOBILE_ROWS, MobileCardFold } from "../MobileCardFold";

afterEach(cleanup);

type Row = { id: string; name: string };

const rowsOf = (count: number, prefix = "Row"): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix} ${i}` }));

function Fold({ rows, page }: { rows: Row[]; page: number }) {
  return (
    <MobileCardFold
      key={page}
      columns={[{ field: "name" }]}
      rows={rows}
      rowKey="id"
      onRowClick={() => {}}
    />
  );
}

describe("MobileCardFold", () => {
  it("shows every card when the page fits, with no fold button", () => {
    const { container } = render(<Fold rows={rowsOf(MOBILE_ROWS)} page={1} />);
    expect(container.querySelectorAll("li")).toHaveLength(MOBILE_ROWS);
    expect(screen.queryByRole("button", { name: /more/ })).toBeNull();
  });

  it("folds the cards past the first ten behind one button, and unfolding focuses the first new card", () => {
    const { container } = render(<Fold rows={rowsOf(14)} page={1} />);
    expect(container.querySelectorAll("li")).toHaveLength(MOBILE_ROWS);
    fireEvent.click(screen.getByRole("button", { name: "4 more" }));
    const cards = container.querySelectorAll("li");
    expect(cards).toHaveLength(14);
    expect(cards[MOBILE_ROWS]?.contains(document.activeElement)).toBe(true);
    expect(screen.queryByRole("button", { name: "4 more" })).toBeNull();
  });

  it("starts folded again on the next page", () => {
    const { container, rerender } = render(<Fold rows={rowsOf(14)} page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "4 more" }));
    rerender(<Fold rows={rowsOf(12, "Next")} page={2} />);
    expect(container.querySelectorAll("li")).toHaveLength(MOBILE_ROWS);
    expect(screen.getByRole("button", { name: "2 more" })).toBeTruthy();
  });

  it("selects every row on the page with one 44 px control, folded cards included", () => {
    const onSelectionChange = vi.fn();
    const rows = rowsOf(14);
    const fold = (selection: string[]) => (
      <MobileCardFold
        columns={[{ field: "name" }]}
        rows={rows}
        rowKey="id"
        selection={selection}
        onSelectionChange={onSelectionChange}
      />
    );
    const { rerender } = render(fold(["Row1"]));
    const all = screen.getByRole("checkbox", { name: "Select all rows on this page" });
    expect(all.getAttribute("aria-checked")).toBe("mixed");
    expect(all.className).toContain("fp-h-11");
    fireEvent.click(all);
    expect(new Set(onSelectionChange.mock.lastCall?.[0])).toEqual(
      new Set(rows.map((row) => row.id)),
    );
    rerender(fold(rows.map((row) => row.id)));
    fireEvent.click(screen.getByRole("checkbox", { name: "Deselect all rows on this page" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("shows no select-all when rows cannot be selected", () => {
    render(<Fold rows={rowsOf(3)} page={1} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
