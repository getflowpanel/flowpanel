import { compileAdmin } from "./compiler/compile-admin";
import type { CompiledAdmin } from "./types/compiled";
import type { AdminConfig, ResolvedAdminConfig } from "./types/config";
import type { AnyResourceConfig } from "./types/resource";

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
