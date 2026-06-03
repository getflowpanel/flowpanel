// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileCardList } from "../MobileCardList.js";

afterEach(() => cleanup());

type User = { id: string; name: string; email: string };

const rows: User[] = [
  { id: "1", name: "Alice", email: "a@b.co" },
  { id: "2", name: "Bob", email: "b@b.co" },
];

describe("MobileCardList", () => {
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
});
