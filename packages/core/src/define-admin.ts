import type { AdminConfig, ResolvedAdminConfig } from "./types/config.js";
import type { ResourceConfig } from "./types/resource.js";

function resolveResourceName(ref: unknown, options: { name?: string }): string {
  if (options.name) return options.name;
  if (ref && typeof ref === "object") {
    const r = ref as { __name?: unknown; _?: { name?: unknown } };
    if (typeof r.__name === "string") return r.__name;
    if (r._ && typeof r._ === "object" && typeof r._.name === "string") return r._.name;
    // Drizzle: table name lives on Symbol(drizzle:Name).
    for (const sym of Object.getOwnPropertySymbols(ref)) {
      if (sym.description === "drizzle:Name") {
        const v = (ref as Record<symbol, unknown>)[sym];
        if (typeof v === "string") return v;
      }
    }
  }
  throw new Error(
    "Unable to resolve resource name. Pass options.name explicitly, " +
      "or ensure the adapter ref exposes __name or _.name.",
  );
}

export function defineAdmin(config: AdminConfig): ResolvedAdminConfig {
  const resourcesByName = new Map<string, ResourceConfig>();
  for (const r of config.resources ?? []) {
    const name = resolveResourceName(r.ref, r.options);
    if (resourcesByName.has(name)) {
      throw new Error(`Duplicate resource name: "${name}". Each resource name must be unique.`);
    }
    resourcesByName.set(name, r);
  }
  return { ...config, __resolved: true, resourcesByName };
}
