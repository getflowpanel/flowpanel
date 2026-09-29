import type { ResourceConfig } from "@flowpanel/core";
import { humanize } from "@flowpanel/core";

/**
 * Name for a single row: `New {labelOne ?? label ?? name}`, since `label` is usually plural and reads wrong there.
 * Shared by the create drawer and the standalone create page so the two cannot drift apart.
 */
export function singularLabel(resource: ResourceConfig, name: string): string {
  return resource.options.labelOne ?? resource.options.label ?? name;
}

/** Name for the collection: the sidebar entry, the list heading and the detail crumb. */
export function pluralLabel(resource: ResourceConfig, name: string): string {
  return resource.options.plural ?? resource.options.label ?? humanize(name);
}
