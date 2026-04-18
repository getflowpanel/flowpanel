/**
 * Normalized filter IR utilities — create, merge, and serialize NormalizedFilter arrays.
 */

import type { FilterOp, NormalizedFilter } from "./types";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a NormalizedFilter object.
 */
export function createFilter(field: string, op: FilterOp, value: unknown): NormalizedFilter {
  return { field, op, value };
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Merges two filter arrays. Incoming filters override existing ones when
 * both field AND op match. Filters with no matching incoming entry are kept.
 */
export function mergeFilters(
  existing: NormalizedFilter[],
  incoming: NormalizedFilter[],
): NormalizedFilter[] {
  // Build a set of field+op keys from incoming for quick lookup
  const overrideKeys = new Set(incoming.map((f) => `${f.field}::${f.op}`));

  // Keep existing filters that are NOT overridden
  const kept = existing.filter((f) => !overrideKeys.has(`${f.field}::${f.op}`));

  return [...kept, ...incoming];
}

// ---------------------------------------------------------------------------
// URL serialization
// ---------------------------------------------------------------------------

const FILTERS_PARAM_KEY = "fp_filters";

/**
 * Serializes a NormalizedFilter array into URLSearchParams.
 * Uses a single JSON-encoded parameter key.
 */
export function filtersToSearchParams(filters: NormalizedFilter[]): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.length === 0) return params;
  params.set(FILTERS_PARAM_KEY, JSON.stringify(filters));
  return params;
}

/**
 * Deserializes a NormalizedFilter array from URLSearchParams.
 * Returns an empty array when the key is absent or the value is invalid.
 */
export function searchParamsToFilters(params: URLSearchParams): NormalizedFilter[] {
  const raw = params.get(FILTERS_PARAM_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as NormalizedFilter[];
  } catch {
    return [];
  }
}
