import type { ResourceIntrospection } from "./adapter";
import type { AdminDefinition, ResolvedAdminConfig } from "./config";
import type { ResourceConfig } from "./resource";

/** @internal Normalized resource data shared by every runtime surface. */
export interface CompiledResource {
  readonly name: string;
  readonly definition: ResourceConfig;
  readonly introspection: ResourceIntrospection | null;
}

/** @internal Private compiled graph. Public integrations consume it through runtime factories. */
export interface CompiledAdmin {
  readonly definition: AdminDefinition;
  readonly resolved: ResolvedAdminConfig;
  readonly resourcesByName: ReadonlyMap<string, CompiledResource>;
}
