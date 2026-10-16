"use client";
import type * as React from "react";

/** Names a cell's full text in its tooltip only when the cell cuts it off. */
function titleIfCut(cell: HTMLElement): void {
  const cut =
    cell.scrollWidth > cell.clientWidth ||
    Array.from(cell.querySelectorAll<HTMLElement>(".fp-truncate")).some(
      (node) => node.scrollWidth > node.clientWidth,
    );
  const text = cell.textContent?.trim() ?? "";
  if (cut && text !== "") cell.title = text;
  else cell.removeAttribute("title");
}

/** The table's scroller: both axes, so the header and first column stick inside it; column widths read its width. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-fp-table-scroll=""
      className="fp-overflow-auto fp-width-container"
      onScroll={(event) => {
        event.currentTarget.toggleAttribute("data-scrolled", event.currentTarget.scrollLeft !== 0);
      }}
      onPointerOver={(event) => {
        const cell =
          event.target instanceof Element ? event.target.closest("[data-fp-cell]") : null;
        if (cell instanceof HTMLElement) titleIfCut(cell);
      }}
    >
      {children}
    </div>
  );
}
