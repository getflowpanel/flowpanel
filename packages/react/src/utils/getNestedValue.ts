/**
 * Retrieves a deeply nested value from an object using a dot-separated path.
 * e.g. getNestedValue({ user: { email: "a@b.com" } }, "user.email") → "a@b.com"
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}
