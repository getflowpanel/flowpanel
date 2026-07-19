"use client";
import { FilterBar, type FilterBarSpec, useAdminTable } from "@flowpanel/react";

export interface ResourceListFiltersProps {
  filters: FilterBarSpec[];
}

export function ResourceListFilters({ filters }: ResourceListFiltersProps) {
  const table = useAdminTable();
  if (filters.length === 0) return null;
  return (
    // No margin here: this sits inside an `items-center` row, where a bottom
    // margin centres the margin box and lifts the pills off the baseline the
    // search field and buttons share. The row owns the spacing.
    <FilterBar
      filters={filters}
      values={table.filters}
      onChange={table.setFilter}
      onClear={table.clearFilters}
    />
  );
}
