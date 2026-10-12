import { isFilterInValue, isFilterRangeValue } from "../types/context";

/** One filter, decoded from the URL-shaped value an adapter receives, for the adapter to map to its query language. */
export type FilterCondition =
  | { op: "isNull"; field: string }
  | { op: "notNull"; field: string }
  | { op: "eq"; field: string; value: unknown }
  | { op: "in"; field: string; values: readonly unknown[] }
  | { op: "range"; field: string; gte?: unknown; lte?: unknown };

/** Filter map to conditions, skipping empty values and fields `isKnown` rejects. */
export function filterConditions(
  filters: Readonly<Record<string, unknown>> | undefined,
  isKnown: (field: string) => boolean = () => true,
): FilterCondition[] {
  const conditions: FilterCondition[] = [];
  for (const [field, value] of Object.entries(filters ?? {})) {
    if (value === undefined || value === null || value === "" || !isKnown(field)) continue;
    if (value === "__null__") conditions.push({ op: "isNull", field });
    else if (value === "__notnull__") conditions.push({ op: "notNull", field });
    else if (isFilterRangeValue(value)) {
      if (value.gte === undefined && value.lte === undefined) continue;
      conditions.push({
        op: "range",
        field,
        ...(value.gte !== undefined ? { gte: value.gte } : {}),
        ...(value.lte !== undefined ? { lte: value.lte } : {}),
      });
    } else if (isFilterInValue(value)) {
      if (value.values.length > 0) conditions.push({ op: "in", field, values: value.values });
    } else conditions.push({ op: "eq", field, value });
  }
  return conditions;
}

/** The declared search fields a term runs over: text columns only, and none without a term. */
export function searchedFields(
  search: string | undefined,
  searchFields: readonly string[] | undefined,
  isText: (field: string) => boolean,
): string[] {
  if (!search || !searchFields?.length) return [];
  return searchFields.filter(isText);
}
