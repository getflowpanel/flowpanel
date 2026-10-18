import type { ResolvedAdminConfig } from "@flowpanel/core";

/** Drops a booted resource's scope: `defineAdmin` refuses the config, so this reaches the runtime's own guard. */
export function withoutScope<Config extends ResolvedAdminConfig>(
  config: Config,
  name: string,
): Config {
  const resource = config.resourcesByName.get(name);
  if (!resource) throw new Error(`fixture: resource ${name} not registered`);
  Reflect.deleteProperty(resource.options, "scope");
  return config;
}
