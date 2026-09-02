// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabelsProvider } from "../../_provider/LabelsContext";
import { MobileCardList } from "../MobileCardList";

afterEach(() => cleanup());

type User = { id: string; name: string; email: string };

const rows: User[] = [
  { id: "1", name: "Alice", email: "a@b.co" },
  { id: "2", name: "Bob", email: "b@b.co" },
];

describe("MobileCardList", () => {
  it("animates only the explicitly created mobile card", () => {
    const { container } = render(
      <MobileCardList
        columns={[{ field: "name" }, { field: "email" }]}
        rows={rows}
        rowKey="id"
        enteringRowKeys={["2"]}
      />,
    );

    const cards = [...container.querySelectorAll("li")];
    expect(cards[0]?.classList.contains("fp-row-enter")).toBe(false);
    expect(cards[1]?.classList.contains("fp-row-enter")).toBe(true);
  });

  it("renders the row as a non-button element with role=button so nested buttons stay valid", () => {
    render(
      <MobileCardList
        columns={[{ field: "name" }, { field: "email" }]}
        rows={rows}
        rowKey="id"
        onRowClick={() => {}}
        rowEndCell={() => (
          <button type="button" aria-label="Row actions">
            …
          </button>
        )}
      />,
    );

    const wrappers = screen.getAllByRole("button", { name: /^Open / });
    expect(wrappers).toHaveLength(2);
    for (const w of wrappers) {
      // The outer card wrapper must NOT be a native <button>, otherwise the
      // nested kebab <button> would be illegal HTML.
      expect(w.tagName).not.toBe("BUTTON");
      expect(w.tagName).toBe("DIV");
      expect(w.getAttribute("role")).toBe("button");
      expect(w.getAttribute("tabindex")).toBe("0");
    }

    // The kebab button still renders inside the card.
    expect(screen.getAllByRole("button", { name: "Row actions" })).toHaveLength(2);
  });

  it("invokes onRowClick on click and on Enter / Space keypress", () => {
    const onRowClick = vi.fn();
    render(
      <MobileCardList
        columns={[{ field: "name" }]}
        rows={rows}
        rowKey="id"
        onRowClick={onRowClick}
      />,
    );

    const [firstCard] = screen.getAllByRole("button", { name: /^Open Alice/ });
    if (!firstCard) throw new Error("expected wrapper");
    fireEvent.click(firstCard);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    fireEvent.keyDown(firstCard, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(firstCard, { key: " " });
    expect(onRowClick).toHaveBeenCalledTimes(3);
  });

  it("looks up prerenderedCells by ORIGINAL column index even when columns are reordered/filtered", () => {
    // Original order: name=0, email=1. DataTable hands MobileCardList a
    // reordered/visible subset (email first) but the server-rendered cells in
    // `prerenderedCells` are still indexed against the original order.
    const colIndexByField = new Map<string, number>([
      ["name", 0],
      ["email", 1],
    ]);
    // Only the email cell (original index 1) is prerendered; name is left to
    // the default renderer so we can tell the two slots apart.
    const prerenderedCells = [
      [undefined, <span key="e0">PRE-email-Alice</span>],
      [undefined, <span key="e1">PRE-email-Bob</span>],
    ];

    render(
      <MobileCardList
        columns={[{ field: "email" }, { field: "name" }]}
        colIndexByField={colIndexByField}
        prerenderedCells={prerenderedCells}
        rows={rows}
        rowKey="id"
      />,
    );

    // Correct mapping: email slot shows its prerender, name slot shows raw value.
    expect(screen.getByText("PRE-email-Alice")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    // Bug regression: if the lookup used the reordered subset index, the email
    // cell would fall through to the raw value and the name slot would steal
    // email's prerender.
    expect(screen.queryByText("a@b.co")).toBeNull();
  });

  it("renders array columns through ArrayCell on mobile instead of String()-coercing", () => {
    render(
      <MobileCardList
        columns={[{ field: "name" }, { field: "tags", type: "array" }]}
        rows={[{ id: "1", name: "Alice", tags: ["x", "y"] }]}
        rowKey="id"
      />,
    );
    // ArrayCell exposes the items via aria-label; the old default branch would
    // have emitted the literal "x,y" string node instead.
    expect(screen.getByLabelText(/2 items: x, y/)).toBeTruthy();
    expect(screen.queryByText("x,y")).toBeNull();
  });

  it("does not propagate row click when interacting with the row-end actions area", () => {
    const onRowClick = vi.fn();
    const onActionClick = vi.fn();
    render(
      <MobileCardList
        columns={[{ field: "name" }]}
        rows={rows}
        rowKey="id"
        onRowClick={onRowClick}
        rowEndCell={() => (
          <button type="button" aria-label="Row actions" onClick={onActionClick}>
            …
          </button>
        )}
      />,
    );

    const [firstCard] = screen.getAllByRole("button", { name: /^Open Alice/ });
    if (!firstCard) throw new Error("expected wrapper");
    const kebab = within(firstCard.parentElement as HTMLElement).getByRole("button", {
      name: "Row actions",
    });
    fireEvent.click(kebab);
    expect(onActionClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("shows the field's label, not its raw name, for non-title columns", () => {
    render(
      <MobileCardList
        columns={[{ field: "name" }, { field: "createdAt", label: "Created" }]}
        rows={[{ id: "1", name: "Alice", createdAt: "2026-01-01" }]}
        rowKey="id"
      />,
    );
    expect(screen.getByText("Created")).toBeTruthy();
    expect(screen.queryByText("createdAt")).toBeNull();
  });

  it("humanizes an unlabeled field instead of showing the raw camelCase name", () => {
    render(
      <MobileCardList
        columns={[{ field: "name" }, { field: "createdAt" }]}
        rows={[{ id: "1", name: "Alice", createdAt: "2026-01-01" }]}
        rowKey="id"
      />,
    );
    expect(screen.getByText("Created at")).toBeTruthy();
    expect(screen.queryByText("createdAt")).toBeNull();
  });

  it("renders localized empty title via LabelsProvider when emptyTitle prop omitted", () => {
    render(
      <LabelsProvider value={{ noResults: "Ничего не найдено" }}>
        <MobileCardList columns={[{ field: "name" }]} rows={[]} rowKey="id" />
      </LabelsProvider>,
    );
    expect(screen.getByText("Ничего не найдено")).toBeTruthy();
  });

  it("gives row selection a 44px mobile hit area without enlarging its visual mark", () => {
    render(
      <MobileCardList
        columns={[{ field: "name" }]}
        rows={rows}
        rowKey="id"
        selection={[]}
        onSelectionChange={() => {}}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Select row 1" });
    expect(checkbox.className).toContain("h-11");
    expect(checkbox.className).toContain("w-11");
    expect(checkbox.className).toContain("sm:h-5");
    expect(checkbox.className).toContain("sm:w-5");
    expect(checkbox.querySelector("span")?.className).toContain("h-4");
    expect(checkbox.querySelector("span")?.className).toContain("w-4");
  });
});
