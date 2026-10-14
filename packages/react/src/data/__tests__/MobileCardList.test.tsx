// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabelsProvider } from "../../provider/LabelsContext";
import { MobileCardList } from "../MobileCardList";

afterEach(() => cleanup());

type User = { id: string; name: string; email: string };

const rows: User[] = [
  { id: "1", name: "Alice", email: "a@b.co" },
  { id: "2", name: "Bob", email: "b@b.co" },
];

describe("MobileCardList", () => {
  it("wraps a long value and gives the title two lines, so a phone reader sees all of it", () => {
    const { container } = render(
      <MobileCardList
        columns={[{ field: "name" }, { field: "email" }]}
        rows={[{ id: "1", name: "Alice", email: "procurement.department@northwind-audio.example" }]}
        rowKey="id"
      />,
    );
    const value = container.querySelector("dd");
    expect(value?.className).toContain("fp-break-words");
    expect(value?.className).not.toMatch(/(^| )fp-truncate( |$)/);
    expect(screen.getByText("Alice").closest(".fp-line-clamp-2")).not.toBeNull();
  });

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

  it("opens through the title's own button, beside the row's other controls, never around them", () => {
    render(
      <MobileCardList
        columns={[{ field: "name" }, { field: "email" }]}
        rows={rows}
        rowKey="id"
        onRowClick={() => {}}
        onSelectionChange={() => {}}
        rowEndCell={() => (
          <button type="button" aria-label="Row actions">
            …
          </button>
        )}
      />,
    );

    const links = screen.getAllByRole("button", { name: /^Open / });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.tagName).toBe("BUTTON");
      expect(link.querySelector("button, a, [role='checkbox']")).toBeNull();
      expect(link.closest("[role='button']:not(button)")).toBeNull();
    }
    expect(screen.getAllByRole("button", { name: "Row actions" })).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("names the card with the row's kind and title", () => {
    render(
      <MobileCardList
        columns={[{ field: "id" }, { field: "name" }]}
        rows={rows}
        rowKey="id"
        rowLabel="run"
        onRowClick={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: `Open run ${rows[0]?.id}` })).toBeTruthy();
  });

  it("invokes onRowClick when the card's link is clicked", () => {
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
    if (!firstCard) throw new Error("expected the card link");
    fireEvent.click(firstCard);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
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

    const kebab = screen.getAllByRole("button", { name: "Row actions" })[0];
    if (!kebab) throw new Error("expected the row actions");
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
      <LabelsProvider value={{ table: { noResults: "Ничего не найдено" } }}>
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
    expect(checkbox.className).toContain("fp-h-11");
    expect(checkbox.className).toContain("fp-w-11");
    expect(checkbox.className).toContain("sm:fp-h-5");
    expect(checkbox.className).toContain("sm:fp-w-5");
    expect(checkbox.querySelector("span")?.className).toContain("fp-h-4");
    expect(checkbox.querySelector("span")?.className).toContain("fp-w-4");
  });

  it("does not open the card when Enter lands on a link inside it", () => {
    const onRowClick = vi.fn();
    render(
      <MobileCardList
        columns={[{ field: "name" }, { field: "site", format: "url" }]}
        rows={[{ id: "1", name: "Alice", site: "https://kwork.ru" }]}
        rowKey="id"
        onRowClick={onRowClick}
      />,
    );
    fireEvent.keyDown(screen.getByRole("link"), { key: "Enter" });
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
