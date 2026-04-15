"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Plus } from "lucide-react";
import type { SerializedResource } from "@flowpanel/core";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../utils/cn";
import { FilterWidget } from "./filters";

export function ResourceToolbar({
  resource,
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters,
  onCreateClick,
}: {
  resource: SerializedResource;
  search: string;
  onSearchChange: (search: string) => void;
  filters: Record<string, unknown>;
  onFilterChange: (filterId: string, value: unknown) => void;
  onClearFilters: () => void;
  onCreateClick?: () => void;
}) {
  const hasSearch = resource.searchFields.length > 0;
  const hasFilters = resource.filters.length > 0;
  const hasActiveFilters =
    search.length > 0 ||
    Object.values(filters).some((v) => v !== undefined && v !== null && v !== "");

  // Debounced search input
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync local state when external search changes (e.g. clear filters)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    clearTimeout(debounceRef.current);
    onSearchChange("");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: search + New button */}
      <div className="flex items-center gap-3">
        {hasSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={`Search ${resource.labelPlural.toLowerCase()}…`}
              value={localSearch}
              onChange={handleSearchInput}
              className="pl-8 pr-8"
            />
            {localSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs">
              <X className="h-3.5 w-3.5 mr-1" />
              Clear filters
            </Button>
          )}
          {resource.access.create && onCreateClick && (
            <Button size="sm" onClick={onCreateClick}>
              <Plus className="h-4 w-4 mr-1" />
              New {resource.label}
            </Button>
          )}
        </div>
      </div>

      {/* Filter row */}
      {hasFilters && (
        <div className={cn("flex flex-wrap gap-2")}>
          {resource.filters.map((filter) => (
            <FilterWidget
              key={filter.id}
              filter={filter}
              value={filters[filter.id]}
              onChange={(value) => onFilterChange(filter.id, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
