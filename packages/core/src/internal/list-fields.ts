/** Fields a resource's list reads from its URL: columns, filters, search fields and the default sort. */
export function declaredListFields(options: {
  columns?: unknown[] | undefined;
  filters?: unknown[] | undefined;
  search?: unknown[] | undefined;
  defaultSort?: { field: string } | undefined;
}): Set<string> {
  const fields = new Set<string>();
  const add = (entry: unknown): void => {
    if (typeof entry === "string") {
      if (entry) fields.add(entry);
      return;
    }
    if (entry && typeof entry === "object") {
      const field = (entry as { field?: unknown }).field;
      if (typeof field === "string" && field) fields.add(field);
    }
  };
  for (const column of options.columns ?? []) add(column);
  for (const filter of options.filters ?? []) add(filter);
  for (const search of options.search ?? []) add(search);
  if (options.defaultSort?.field) fields.add(options.defaultSort.field);
  return fields;
}
