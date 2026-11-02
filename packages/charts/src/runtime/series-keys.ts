/** A chart's `y` as a list; the server fills it from the data when the config leaves it out. */
export function seriesKeys(y: string | readonly string[] | undefined): string[] {
  if (y === undefined) return [];
  return typeof y === "string" ? [y] : [...y];
}
