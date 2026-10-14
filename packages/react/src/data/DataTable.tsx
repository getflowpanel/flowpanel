"use client";
// LOC-OK: one state for the loading, empty, phone and grid branches; the toolbar, head and body live in their own files.
import * as React from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "../lib/cn";
import { useComponentOverrides } from "../provider/ComponentsContext";
import { useLabels } from "../provider/LabelsContext";
import { ShortcutsHint } from "../shell/ShortcutsHint";
import { layoutColumns, REM_PX, ROW_END_REM, SELECTION_WIDTH_PX } from "./column-sizing";
import { DataTableBody } from "./DataTableBody";
import { DataTableHeader } from "./DataTableHeader";
import { CardListSkeleton, DataTableSkeleton, skeletonRowCount } from "./DataTableSkeleton";
import { DataTableToolbar, exportSetupOf } from "./DataTableToolbar";
import type { DataTableDensity } from "./DensityToggle";
import type { DataTableColumn, DataTableProps } from "./data-table-types";
import { MobileCardFold } from "./MobileCardFold";
import { Pagination } from "./Pagination";
import { TableEmptyState } from "./TableEmptyState";
import { TableScroll } from "./TableScroll";
import { useColumnLayout } from "./useColumnLayout";
import { useDataTableKeyboard } from "./useDataTableKeyboard";
import { useDataTableSelection } from "./useDataTableSelection";
import { useTableLive } from "./useTableLive";

export type {
  DataTableColumn,
  DataTableProps,
  DataTableSort,
} from "./data-table-types";

export function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  total,
  page,
  pageSize,
  rowKey,
  sort = null,
  density = "comfortable",
  loading = false,
  onRowClick,
  onSortChange,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyIcon,
  className,
  selection,
  onSelectionChange,
  getRowKey,
  prerenderedCells,
  columnVisibility,
  columnWidths,
  onColumnWidthsChange,
  pinnedColumns,
  onPinnedColumnsChange,
  realtime,
  rowEndCell,
  rowEndCellLabel: rowEndCellLabelOverride,
  onEditRow,
  onDeleteRow,
  onFocusSearch,
  onShowShortcuts,
  inlineEditResource,
  mobileLayout = "card",
  enteringRowKeys = [],
  exportable = false,
  importable,
  showDensityToggle = false,
  rowLabel,
}: DataTableProps<Row>) {
  const labels = useLabels();
  const rowEndCellLabel = rowEndCellLabelOverride ?? labels.table.actions;
  const effectiveEmptyTitle = emptyTitle ?? labels.table.noResults;
  const { EmptyState: EmptyOverride, SkeletonTable: SkeletonOverride } = useComponentOverrides();
  const Empty = EmptyOverride ?? TableEmptyState;

  const selectionEnabledProp = onSelectionChange !== undefined;
  const layout = useColumnLayout<Row>({
    columns,
    leadingPx: selectionEnabledProp ? SELECTION_WIDTH_PX : 0,
    ...(columnVisibility ? { columnVisibility } : {}),
    ...(columnWidths ? { columnWidths } : {}),
    ...(pinnedColumns ? { pinnedColumns } : {}),
  });
  const {
    orderedVisible,
    colIndexByField,
    leftPins,
    rightPins,
    pinMeta,
    effectiveWidths,
    setLiveWidths,
    liveWidthsRef,
    resizingRef,
  } = layout;

  const live = useTableLive(realtime);

  const isMobile = useMediaQuery("(max-width: 639px)");

  const [densityOverride, setDensityOverride] = React.useState<DataTableDensity | null>(null);
  const [densityProp, setDensityProp] = React.useState(density);
  if (densityProp !== density) {
    setDensityProp(density);
    setDensityOverride(null);
  }
  const effectiveDensity = densityOverride ?? density;
  const rowPadding = effectiveDensity === "compact" ? "fp-py-2.5" : "fp-py-3";

  const selectionApi = useDataTableSelection<Row>({
    rows,
    rowKey,
    ...(selection ? { selection } : {}),
    ...(onSelectionChange ? { onSelectionChange } : {}),
    ...(getRowKey ? { getRowKey } : {}),
  });
  const {
    selectionEnabled,
    identityOf,
    selectionSet,
    allOnPageSelected,
    someOnPageSelected,
    toggleRow,
    toggleAll,
  } = selectionApi;
  const enteringKeySet = React.useMemo(() => new Set(enteringRowKeys), [enteringRowKeys]);

  const keyboard = useDataTableKeyboard<Row>({
    rows,
    identityOf,
    ...(onRowClick ? { onRowClick } : {}),
    ...(onEditRow ? { onEditRow } : {}),
    ...(onDeleteRow ? { onDeleteRow } : {}),
    ...(onFocusSearch ? { onFocusSearch } : {}),
    ...(onShowShortcuts ? { onShowShortcuts } : {}),
  });
  const { cursor, setCursor, handleKeyDown, opensRows } = keyboard;

  const handleHeaderClick = (c: DataTableColumn<Row>) => {
    if (!c.sortable) return;
    const active = sort?.field === c.field;
    const nextDir: "asc" | "desc" = active && sort?.dir === "asc" ? "desc" : "asc";
    onSortChange?.({ field: c.field, dir: nextDir });
  };

  // Clips the rounded corners; the table scrolls inside `TableScroll`.
  const frame =
    "fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-shadow-xs fp-overflow-clip";

  const exportSetup = exportSetupOf(exportable, rows.length, columns, orderedVisible);
  const showToolbar =
    exportSetup !== null || Boolean(importable) || showDensityToggle || live.configured;
  const toolbar = showToolbar ? (
    <DataTableToolbar
      total={total}
      liveStatus={live.configured ? live.status : null}
      density={showDensityToggle ? effectiveDensity : null}
      onDensityChange={setDensityOverride}
      importable={importable}
      exportSetup={exportSetup}
      rows={rows}
      tableLabel={inlineEditResource ?? emptyTitle ?? "export"}
    />
  ) : null;

  const pagination = (className?: string) => (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      {...(className ? { className } : {})}
      {...(onPageChange ? { onChange: onPageChange } : {})}
      {...(pageSizeOptions ? { pageSizeOptions } : {})}
      {...(onPageSizeChange ? { onPageSizeChange } : {})}
    />
  );

  const { widths, minWidth } = layoutColumns(orderedVisible, {
    overrides: effectiveWidths,
    pinned: new Set([...leftPins, ...rightPins]),
    extrasRem:
      (selectionEnabled ? SELECTION_WIDTH_PX / REM_PX : 0) + (rowEndCell ? ROW_END_REM : 0),
  });
  if (loading) {
    return (
      <div className={cn(frame, className)} aria-busy="true">
        {toolbar}
        {SkeletonOverride ? (
          <SkeletonOverride rows={skeletonRowCount(pageSize)} columns={orderedVisible.length} />
        ) : mobileLayout === "card" && isMobile ? (
          <CardListSkeleton orderedVisible={orderedVisible} pageSize={pageSize} />
        ) : (
          <DataTableSkeleton
            orderedVisible={orderedVisible}
            widths={widths}
            minWidth={minWidth}
            pageSize={pageSize}
            rowPadding={rowPadding}
            selectionEnabled={selectionEnabled}
            rowEndCell={rowEndCell}
            rowEndCellLabel={rowEndCellLabel}
          />
        )}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn(frame, className)}>
        {toolbar}
        <Empty
          title={effectiveEmptyTitle}
          {...(emptyDescription ? { description: emptyDescription } : {})}
          {...(emptyAction ? { action: emptyAction } : {})}
          {...(emptyIcon ? { icon: emptyIcon } : {})}
        />
        {/* An empty page of a non-empty set still needs a way back to the rows. */}
        {total > 0 ? pagination() : null}
      </div>
    );
  }

  const showMobileCardView = mobileLayout === "card" && isMobile;

  if (showMobileCardView) {
    return (
      <div className={cn(frame, className)}>
        {toolbar}
        <div className="fp-p-2">
          <MobileCardFold
            key={page}
            columns={orderedVisible}
            colIndexByField={colIndexByField}
            rows={rows}
            rowKey={rowKey}
            {...(getRowKey ? { getRowKey } : {})}
            {...(prerenderedCells ? { prerenderedCells } : {})}
            {...(onRowClick ? { onRowClick } : {})}
            {...(selection ? { selection } : {})}
            {...(onSelectionChange ? { onSelectionChange } : {})}
            {...(rowEndCell ? { rowEndCell } : {})}
            {...(emptyTitle ? { emptyTitle } : {})}
            {...(emptyDescription ? { emptyDescription } : {})}
            {...(emptyAction ? { emptyAction } : {})}
            {...(emptyIcon ? { emptyIcon } : {})}
            enteringRowKeys={enteringRowKeys}
            {...(rowLabel ? { rowLabel } : {})}
          />
        </div>
        {pagination()}
      </div>
    );
  }

  const lastLeftPin = [...orderedVisible]
    .reverse()
    .find((c) => pinMeta.get(c.field)?.side === "left")?.field;
  return (
    <div className={cn(frame, className)}>
      {toolbar}
      <TableScroll>
        <table
          className="fp-w-full fp-table-fixed fp-text-sm"
          style={{ minWidth }}
          aria-rowcount={total + 1}
        >
          <DataTableHeader
            orderedVisible={orderedVisible}
            sort={sort}
            pinMeta={pinMeta}
            effectiveWidths={effectiveWidths}
            widths={widths}
            leftPins={leftPins}
            rightPins={rightPins}
            selectionEnabled={selectionEnabled}
            allOnPageSelected={allOnPageSelected}
            someOnPageSelected={someOnPageSelected}
            onToggleAll={toggleAll}
            onHeaderClick={handleHeaderClick}
            {...(onColumnWidthsChange ? { onColumnWidthsChange } : {})}
            {...(onPinnedColumnsChange ? { onPinnedColumnsChange } : {})}
            resizingRef={resizingRef}
            liveWidthsRef={liveWidthsRef}
            setLiveWidths={setLiveWidths}
            rowEndCell={rowEndCell}
            rowEndCellLabel={rowEndCellLabel}
          />
          <DataTableBody<Row>
            rows={rows}
            identityOf={identityOf}
            firstRowIndex={(page - 1) * pageSize}
            enteringKeySet={enteringKeySet}
            cursor={cursor}
            setCursor={setCursor}
            onKeyDown={handleKeyDown}
            keyboardRows={opensRows}
            orderedVisible={orderedVisible}
            pinMeta={pinMeta}
            lastLeftPin={lastLeftPin}
            colIndexByField={colIndexByField}
            rowPadding={rowPadding}
            selectionEnabled={selectionEnabled}
            selectionSet={selectionSet}
            onToggleRow={toggleRow}
            {...(prerenderedCells ? { prerenderedCells } : {})}
            {...(inlineEditResource ? { inlineEditResource } : {})}
            {...(onRowClick ? { onRowClick } : {})}
            {...(rowEndCell ? { rowEndCell } : {})}
          />
        </table>
      </TableScroll>
      <div className="fp-flex fp-items-center fp-border-t fp-border-line empty:fp-hidden">
        {opensRows ? <ShortcutsHint /> : null}
        {pagination("fp-flex-1 fp-border-t-0")}
      </div>
    </div>
  );
}
