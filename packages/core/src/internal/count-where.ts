import { didYouMean } from "../suggest";

/**
 * `ctx.count(resource, where)` filters by column name. A typo must not become a
 * whole-table count on one adapter and a thrown query on another, so both count
 * paths check the keys against introspection before anything runs. An adapter
 * that reports no columns cannot resolve the ref, and guessing would reject a
 * valid config.
 */
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
        `Known columns: ${columns.map((c) => `"${c}"`).join(", ")}.`,
    );
  }
}
