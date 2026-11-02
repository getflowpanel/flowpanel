import type { ResourceConfig } from "@flowpanel/core";
import { encodeFilters } from "@flowpanel/core/internal";
import { columnMoneyFactors } from "./money-field";

/** A saved view as the browser's views menu receives it. */
export interface WireView {
  name: string;
  description?: string;
  filters?: Record<string, string>;
  sort?: { field: string; dir: "asc" | "desc" };
  search?: string;
}

/** A resource's `views`, each filter value in the list's own URL form. */
export function wireViews(resource: ResourceConfig, timeZone: string): WireView[] {
  return (resource.options.views ?? []).map(({ filters, ...view }) => ({
    ...view,
    ...(filters ? { filters: encodeFilters(filters, timeZone, columnMoneyFactors(resource)) } : {}),
  }));
}
