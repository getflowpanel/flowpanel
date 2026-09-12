/**
 * A row's identifier, or `null` when the projection carried none. The literal
 * string `"undefined"` is a valid identifier; an absent value or a non-scalar one
 * is not, and coercing either would collide with a real record's key.
 */
export function rowIdentity(row: Record<string, unknown>, rowKey: string): string | null {
  const raw = row[rowKey];
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "bigint") return String(raw);
  return null;
}
