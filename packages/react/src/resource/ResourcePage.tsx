"use client";

import { useEffect, useRef, useState } from "react";
import type { SerializedResource } from "@flowpanel/core";
import { cn } from "../utils/cn";
import { useResourceData } from "../hooks/useResourceData";
import { useUrlState } from "../hooks/useUrlState";
import { ResourceTable } from "./ResourceTable";
import { ResourceToolbar } from "./ResourceToolbar";
import { ResourcePagination } from "./ResourcePagination";
import { ResourceDrawer } from "./ResourceDrawer";
import { ResourceEmptyState } from "./ResourceEmptyState";

type DrawerMode = "detail" | "create" | "edit";

export function ResourcePage({
  resource,
  baseUrl,
}: {
  resource: SerializedResource;
  baseUrl: string;
}) {
  // URL state sync
  const { initialParams, syncToUrl } = useUrlState(resource.id);

  // Data fetching
  const {
    data,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    sort,
    search,
    filters,
    setPage,
    setSort,
    setSearch,
    setFilter,
    clearFilters,
    refresh,
  } = useResourceData({ resource, baseUrl, initialParams });

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("detail");
  const [drawerRow, setDrawerRow] = useState<Record<string, unknown> | undefined>();

  // Selected row for highlight
  const selectedRowId = drawerRow ? String(drawerRow.id ?? "") : undefined;

  // Sync params to URL whenever they change
  const syncRef = useRef(syncToUrl);
  syncRef.current = syncToUrl;

  useEffect(() => {
    syncRef.current({ sort, search, filters, page });
  }, [sort, search, filters, page]);

  // Handlers
  const handleRowClick = (row: Record<string, unknown>) => {
    setDrawerRow(row);
    setDrawerMode("detail");
    setDrawerOpen(true);
  };

  const handleCreateClick = () => {
    setDrawerRow(undefined);
    setDrawerMode("create");
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const handleDrawerSuccess = () => {
    void refresh();
  };

  const isEmpty = !loading && data.length === 0;
  const showEmptyState = isEmpty && !search && Object.keys(filters).length === 0;

  return (
    <div className={cn("flex flex-col gap-4")}>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{resource.labelPlural}</h1>
          {!loading && total > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{total.toLocaleString()} total</p>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-center justify-between text-sm text-destructive">
          <span>Failed to load data: {error}</span>
          <button
            type="button"
            onClick={refresh}
            className="ml-4 underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <ResourceToolbar
        resource={resource}
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        onCreateClick={resource.access.create ? handleCreateClick : undefined}
      />

      {/* Table or empty state */}
      {showEmptyState ? (
        <ResourceEmptyState
          resource={resource}
          onCreateClick={resource.access.create ? handleCreateClick : undefined}
        />
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <ResourceTable
            resource={resource}
            data={data}
            loading={loading}
            sort={sort}
            onSort={setSort}
            onRowClick={handleRowClick}
            selectedRowId={selectedRowId}
          />

          {/* Empty search/filter result */}
          {isEmpty && (search || Object.keys(filters).length > 0) && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No {resource.labelPlural.toLowerCase()} match your current filters.
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 underline underline-offset-2 hover:no-underline"
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="border-t">
            <ResourcePagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Drawer */}
      <ResourceDrawer
        resource={resource}
        mode={drawerMode}
        row={drawerRow}
        open={drawerOpen}
        onClose={handleDrawerClose}
        baseUrl={baseUrl}
        onSuccess={handleDrawerSuccess}
      />
    </div>
  );
}
