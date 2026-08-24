import type { ResourceConfig } from "@flowpanel/core";

/**
 * Name for a single row, as `customization/forms` documents it:
 * `New {labelOne ?? label ?? name}`. `label` is usually plural and reads wrong
 * in that heading, which is what `labelOne` is for. Shared by the create drawer
 * and the standalone create page so the two cannot drift apart.
 */
export function singularLabel(resource: ResourceConfig, name: string): string {
  return resource.options.labelOne ?? resource.options.label ?? name;
}
