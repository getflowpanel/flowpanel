import { fixedShape } from "./column-sizing";
import type { DataTableColumn } from "./data-table-types";

const cutBy = (node: Element): number => node.scrollWidth - node.clientWidth;
const widest = (node: Element): number =>
  Math.max(cutBy(node), ...Array.from(node.querySelectorAll(".fp-truncate"), cutBy));

/** Px each column's header, or a number, date, flag or badge in it, overflows by in the rendered table. */
export function cutColumns<Row>(
  node: HTMLTableElement,
  columns: ReadonlyArray<DataTableColumn<Row>>,
): Record<string, number> {
  const found: Record<string, number> = {};
  const body = Array.from(node.querySelectorAll("tbody tr"), (tr) =>
    tr.querySelectorAll("td[data-fp-cell]"),
  );
  node.querySelectorAll<HTMLElement>("thead th[data-fp-col]").forEach((th, index) => {
    const column = columns.find((c) => c.field === th.dataset.fpCol);
    if (!column) return;
    let cut = widest(th);
    if (fixedShape(column)) {
      for (const cells of body) cut = Math.max(cut, cells[index] ? widest(cells[index]) : 0);
    }
    if (cut > 0.5) found[column.field] = Math.ceil(cut);
  });
  return found;
}
