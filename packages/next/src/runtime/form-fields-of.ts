import type { FieldDef, ResourceConfig } from "@flowpanel/core";

/** Every field a resource's create and edit forms declare, create first. */
export function formFieldsOf(resource: ResourceConfig): FieldDef<Record<string, unknown>>[] {
  return [...(resource.options.create?.fields ?? []), ...(resource.options.update?.fields ?? [])];
}
