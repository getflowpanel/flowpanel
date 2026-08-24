import type { ResourceIntrospection } from "./adapter.js";
import type { AdminConfig, ResolvedAdminConfig } from "./config.js";
import type { ResourceConfig } from "./resource.js";

/** @internal Normalized resource data shared by every runtime surface. */
export interface CompiledResource {
  readonly name: string;
  readonly definition: ResourceConfig;
  readonly introspection: ResourceIntrospection | null;
  readonly clientProjection: readonly string[];
  readonly serverProjection: readonly string[];
}

/** @internal Private compiled graph. Public integrations consume it through runtime factories. */
export interface CompiledAdmin {
  readonly definition: AdminConfig;
  readonly resolved: ResolvedAdminConfig;
  readonly resourcesByName: ReadonlyMap<string, CompiledResource>;
}
