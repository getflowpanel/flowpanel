/** Single source of truth for a resource's name — see invariant I-5. */
export function resolveResourceName(resource: {
  ref: unknown;
  options: { name?: string };
}): string {
  if (resource.options.name) return resource.options.name;
  const ref = resource.ref;
  if (typeof ref === "string" && ref !== "") return ref;
  if (ref && typeof ref === "object") {
    const r = ref as { __name?: unknown; _?: { name?: unknown } };
    if (typeof r.__name === "string") return r.__name;
    if (r._ && typeof r._ === "object" && typeof r._.name === "string") return r._.name;
    for (const sym of Object.getOwnPropertySymbols(ref)) {
      if (sym.description === "drizzle:Name") {
        const value = (ref as Record<symbol, unknown>)[sym];
        if (typeof value === "string") return value;
      }
    }
    for (const sym of Object.getOwnPropertySymbols(ref)) {
      if (sym.description === "drizzle:BaseName") {
        const value = (ref as Record<symbol, unknown>)[sym];
        if (typeof value === "string") return value;
      }
    }
  }
  throw new Error(
    "Unable to resolve resource name. Pass options.name explicitly, " +
      "or ensure the adapter ref exposes __name or _.name.",
  );
}
