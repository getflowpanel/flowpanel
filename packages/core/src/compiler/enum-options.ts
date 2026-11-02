import type { ResourceConfig, SelectOption } from "../types/resource";

const CHOICES = new Set(["select", "multiselect", "radio"]);

function badgeLabels(resource: ResourceConfig): Map<string, Record<string, string>> {
  const found = new Map<string, Record<string, string>>();
  for (const column of resource.options.columns ?? []) {
    if (typeof column !== "object" || column === null || typeof column.field !== "string") continue;
    const format = column.format;
    if (typeof format === "object" && format.kind === "badge" && format.labels) {
      found.set(column.field, format.labels);
    }
  }
  return found;
}

function withOptions<T extends { type?: string; options?: unknown }>(
  entry: T,
  labels: Record<string, string> | undefined,
): T {
  if (!labels || entry.options !== undefined || !CHOICES.has(entry.type ?? "")) return entry;
  const options: SelectOption[] = Object.entries(labels).map(([value, label]) => ({
    label,
    value,
  }));
  return { ...entry, options };
}

/** A select, multiselect or radio without `options` lists the labels of its column's badge format. */
export function withEnumOptions(resource: ResourceConfig): ResourceConfig {
  const labels = badgeLabels(resource);
  if (labels.size === 0) return resource;
  const { filters, create, update } = resource.options;
  return {
    ...resource,
    options: {
      ...resource.options,
      ...(filters
        ? {
            filters: filters.map((entry) =>
              typeof entry === "object" ? withOptions(entry, labels.get(entry.field)) : entry,
            ),
          }
        : {}),
      ...(create?.fields
        ? {
            create: {
              ...create,
              fields: create.fields.map((f) => withOptions(f, labels.get(f.name))),
            },
          }
        : {}),
      ...(update?.fields
        ? {
            update: {
              ...update,
              fields: update.fields.map((f) => withOptions(f, labels.get(f.name))),
            },
          }
        : {}),
    },
  };
}
