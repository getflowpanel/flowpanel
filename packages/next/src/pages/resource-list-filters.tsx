"use client";
import { FilterBar, type FilterBarSpec, useAdminTable } from "@flowpanel/react";

export interface ResourceListFiltersProps {
  filters: FilterBarSpec[];
}

export function ResourceListFilters({ filters }: ResourceListFiltersProps) {
  const table = useAdminTable();
  if (filters.length === 0) return null;
  return (
    <FilterBar
      filters={filters}
      values={table.filters}
      onChange={table.setFilter}
      onClear={table.clearFilters}
      className="mb-4"
    />
  );
}
