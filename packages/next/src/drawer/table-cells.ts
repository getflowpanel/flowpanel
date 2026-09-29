import type { ReactNode } from "react";

let remembered: { key: string; cells: Readonly<Record<string, ReactNode>> } | null = null;

const keyOf = (resource: string, id: string): string => `${resource}\u0000${id}`;

/** Keep the cells the list rendered for the row a drawer opens, for renders the drawer cannot run. */
export function rememberRowCells(
  resource: string,
  id: string,
  cells: Readonly<Record<string, ReactNode>>,
): void {
  remembered = { key: keyOf(resource, id), cells };
}

/** The list's own rendered cell for a field of that row; `undefined` for any other row. */
export function rememberedCell(resource: string, id: string, field: string): ReactNode | undefined {
  return remembered?.key === keyOf(resource, id) ? remembered.cells[field] : undefined;
}
