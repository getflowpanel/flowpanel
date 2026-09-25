import { didYouMean } from "../suggest";
import type { LinkCheck } from "../validate-links";

/** A comma-separated, quoted list for an error message; "(none)" when empty. */
export const quoted = (names: readonly string[]): string =>
  names.map((name) => `"${name}"`).join(", ") || "(none)";

/** Throws: `name` of `kind` is not among `known`, with the closest match suggested. */
export function missing(
  site: string,
  kind: string,
  name: string,
  known: readonly string[],
  on?: string,
): never {
  throw new Error(
    `flowpanel: ${site} names ${kind} "${name}"${on ? ` on "${on}"` : ""}, which does not exist.` +
      `${didYouMean(name, known)} Known: ${quoted(known)}.`,
  );
}

/** `field` is a real column of `resource`, or throws; `false` when the adapter reports none. */
export function checkColumn(
  site: string,
  resource: string,
  field: string,
  check: LinkCheck,
): boolean {
  const columns = check.columnsOf(resource);
  if (columns.length === 0) return false;
  if (!columns.includes(field)) missing(site, "column", field, columns, resource);
  return true;
}
