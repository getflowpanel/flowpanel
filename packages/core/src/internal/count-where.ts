import { didYouMean } from "../suggest";
import { quoted } from "./validate-shared";

/** Throws on a `ctx.count` where key that is not a column; skipped when the adapter reports no columns. */
export function assertCountWhereColumns(
  resource: string,
  where: Record<string, unknown>,
  columns: readonly string[],
): void {
  if (columns.length === 0) return;
  for (const field of Object.keys(where)) {
    if (columns.includes(field)) continue;
    throw new Error(
      `flowpanel: ctx.count("${resource}") filters by "${field}", but the adapter reports no ` +
        `such column on that resource.${didYouMean(field, columns)} ` +
        `Known columns: ${quoted(columns)}.`,
    );
  }
}
