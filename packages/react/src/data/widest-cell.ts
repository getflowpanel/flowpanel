/** Fit to widest never makes a column wider than this, so one long value cannot push the rest off screen. */
export const FIT_MOST_PX = 640;

/** The widest value the column shows on this page, padding included, as laid out in the reader's own font. */
export function widestCellPx(table: HTMLTableElement | null, field: string): number {
  if (table === null) return 0;
  let widest = 0;
  for (const cell of table.querySelectorAll<HTMLElement>(
    `td[data-fp-field="${CSS.escape(field)}"]`,
  )) {
    const range = document.createRange();
    range.selectNodeContents(cell);
    const style = getComputedStyle(cell);
    const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    widest = Math.max(widest, range.getBoundingClientRect().width + (padding || 0));
  }
  return Math.ceil(widest);
}

/** The width a double click or Shift+Enter gives a column: its widest value, never under what the server measured, at most `FIT_MOST_PX`. */
export function fitToWidest(measuredByServer: number, onScreen: number): number {
  return Math.min(FIT_MOST_PX, Math.max(measuredByServer, onScreen));
}
