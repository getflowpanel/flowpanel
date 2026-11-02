import { type KeyLabels, keyLabel } from "../internal/key-labels";
import type { BarRow } from "../types/widget-cards";
import type { LinkTarget } from "../types/widget-context";
import { type Fold, foldRows, OTHER_KEY } from "./series";

export interface BreakdownOptions<R> {
  /** One row per value of this field. */
  by: keyof R & string;
  /** How a value's rows become its number. Default: the row count. */
  value?: Fold<R>;
  /** Values always present, at zero when no row has them. */
  keys?: readonly string[];
  /** Row labels: a map, an `enumOf()`, or a function. Default: the value itself. */
  labels?: KeyLabels;
  /** Keep `keys` and the N largest other rows; the rest fold into one `OTHER_KEY` row. */
  top?: number;
  /** The compared period's rows, folded the same way into each row's `previous`. */
  previous?: readonly R[];
  /** Where a row's label leads. */
  href?: (key: string) => LinkTarget | null;
}

function groupBy<R>(rows: readonly R[], by: string): Map<string, R[]> {
  const groups = new Map<string, R[]>();
  for (const row of rows) {
    const raw = (row as Record<string, unknown>)[by];
    if (raw === null || raw === undefined) continue;
    const key = String(raw);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * One ranked `BarRow` per `by` value with its `share` of the total; with `top`, the rest fold into one `OTHER_KEY` row.
 * A declared `keys` value never folds into that rest, same as `series({ keys, top })`.
 */
export function breakdown<R>(rows: readonly R[], opts: BreakdownOptions<R>): BarRow[] {
  const groups = groupBy(rows, opts.by);
  for (const key of opts.keys ?? []) if (!groups.has(key)) groups.set(key, []);
  const before = opts.previous === undefined ? null : groupBy(opts.previous, opts.by);
  const valued = [...groups]
    .map(([key, members]) => ({ key, value: foldRows(members, opts.value) }))
    .filter((entry): entry is { key: string; value: number } => entry.value !== null)
    .sort((a, b) => b.value - a.value);
  const total = valued.reduce((sum, entry) => sum + entry.value, 0);
  const declared = new Set(opts.keys ?? []);
  const others = valued.filter((entry) => !declared.has(entry.key));
  const room = opts.top === undefined ? others.length : Math.max(0, opts.top);
  const rest = others.slice(room).map((entry) => entry.key);
  const restSet = new Set(rest);
  const shownEntries = valued.filter((entry) => !restSet.has(entry.key));
  const row = (key: string, value: number, members: readonly string[]): BarRow => {
    const previous =
      before === null
        ? null
        : foldRows(
            members.flatMap((m) => before.get(m) ?? []),
            opts.value,
          );
    const href = key === OTHER_KEY ? null : (opts.href?.(key) ?? null);
    return {
      key,
      label: key === OTHER_KEY ? OTHER_KEY : keyLabel(opts.labels, key),
      value,
      ...(total > 0 ? { share: value / total } : {}),
      ...(previous === null ? {} : { previous }),
      ...(href === null ? {} : { href }),
    };
  };
  const shown = shownEntries.map((entry) => row(entry.key, entry.value, [entry.key]));
  if (rest.length === 0) return shown;
  const other = foldRows(
    rest.flatMap((key) => groups.get(key) ?? []),
    opts.value,
  );
  return other === null ? shown : [...shown, row(OTHER_KEY, other, rest)];
}
