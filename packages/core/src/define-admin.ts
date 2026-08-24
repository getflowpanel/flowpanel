import { compileAdmin } from "./compiler/compile-admin.js";
import type { CompiledAdmin } from "./types/compiled.js";
import type { AdminConfig, ResolvedAdminConfig } from "./types/config.js";
import type { AnyResourceConfig } from "./types/resource.js";

const compiledAdminCache = new WeakMap<object, CompiledAdmin>();

/** Define and validate a Flowpanel admin while preserving its resource tuple types. */
export function defineAdmin<
  const Resources extends readonly AnyResourceConfig[] = readonly AnyResourceConfig[],
>(config: AdminConfig<Resources>): ResolvedAdminConfig<Resources> {
  const cached = compiledAdminCache.get(config);
  if (cached) return cached.resolved as ResolvedAdminConfig<Resources>;

  const compiled = compileAdmin(config);
  compiledAdminCache.set(config, compiled);
  compiledAdminCache.set(compiled.resolved, compiled);
  return compiled.resolved as ResolvedAdminConfig<Resources>;
}

/** @internal Used by framework integrations; not re-exported from the public package root. */
export function getCompiledAdmin(value: object): CompiledAdmin {
  const compiled = compiledAdminCache.get(value);
  if (!compiled) {
    throw new Error("The admin definition has not been compiled by defineAdmin().");
  }
  return compiled;
}
