export function titleCaseFromPath(p: string): string {
  return p
    .split(/[-_/]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/**
 * Filter a `{ "<resource>.<key>": fn }` map down to a `{ "<key>": fn }` map
 * for the given resource. Keys without a `"."` prefix apply globally.
 */
export function scopeRenderers<T>(
  all: Record<string, T> | undefined,
  resourceKey: string,
): Record<string, T> | undefined {
  if (!all) return undefined;
  const prefix = `${resourceKey}.`;
  const scoped: Record<string, T> = {};
  let hasAny = false;
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(prefix)) {
      scoped[key.slice(prefix.length)] = value;
      hasAny = true;
    } else if (!key.includes(".")) {
      scoped[key] = value;
      hasAny = true;
    }
  }
  return hasAny ? scoped : undefined;
}
