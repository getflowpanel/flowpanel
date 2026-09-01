"use client";
// LOC-OK: table render orchestrator — coordinates column layout, selection, inline
// edit, realtime refresh and the mobile card view in one place.
import { useRouter } from "next/navigation";
import * as React from "react";
import { LiveIndicator } from "../_atoms/LiveIndicator";
import { useLabels } from "../_provider/LabelsContext";
import { useLiveChannel } from "../hooks/useLiveChannel";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "../lib/cn";
import { useRealtimeBus, useRealtimeStatus } from "../realtime/hooks";
import { ExportButton } from "./csv-export";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableRow } from "./DataTableRow";
import { DataTableSkeleton } from "./DataTableSkeleton";
import { type DataTableDensity, DensityToggle } from "./DensityToggle";
import type { DataTableColumn, DataTableProps } from "./data-table-types";
import { ImportButton } from "./ImportButton";
import { MobileCardList } from "./MobileCardList";
import { Pagination } from "./Pagination";
import { useColumnLayout } from "./useColumnLayout";
import { useDataTableKeyboard } from "./useDataTableKeyboard";
import { useDataTableSelection } from "./useDataTableSelection";

export type {
  DataTableColumn,
  DataTableProps,
  DataTableSort,
} from "./data-table-types";

/** Bus-path subscription callback — the provider runs the refresh. */
const NOOP = (): void => undefined;

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
  rowEndCellLabel = "Actions",
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
}: DataTableProps<Row>) {
  const router = useRouter();
  const labels = useLabels();
  const effectiveEmptyTitle = emptyTitle ?? labels.noResults;

  const layout = useColumnLayout<Row>({
    columns,
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

  const realtimeCfg =
    typeof realtime === "string" ? { channel: realtime, debounceMs: 200 } : realtime;
  const realtimeChannel = realtimeCfg?.channel ?? "";
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLiveEvent = React.useCallback(() => {
    if (!realtimeCfg) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      router.refresh();
    }, realtimeCfg.debounceMs ?? 200);
  }, [realtimeCfg, router]);
  React.useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );
  const bus = useRealtimeBus();
  const busStatus = useRealtimeStatus();
  // Under a provider the bus carries the channel and owns the coalesced refresh; a second
  // EventSource here would double both the connection and the refresh.
  React.useEffect(() => {
    if (!bus || realtimeChannel === "") return;
    return bus.subscribe([realtimeChannel], NOOP);
  }, [bus, realtimeChannel]);
  const poolStatus = useLiveChannel(realtimeChannel, handleLiveEvent, { enabled: !bus });
  const liveStatus = bus ? busStatus : poolStatus;

  const isMobile = useMediaQuery("(max-width: 639px)");

  const [densityOverride, setDensityOverride] = React.useState<DataTableDensity | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: density is intentionally a dependency so a changed controlled prop clears the local override.
  React.useEffect(() => {
    setDensityOverride(null);
  }, [density]);
  const effectiveDensity = densityOverride ?? density;
  const rowPadding = effectiveDensity === "compact" ? "py-1.5" : "py-3";
  const cellText = effectiveDensity === "compact" ? "text-xs" : "";

  const selectionApi = useDataTableSelection<Row>({
    rows,
    rowKey,
    ...(selection ? { selection } : {}),
    ...(onSelectionChange ? { onSelectionChange } : {}),
    ...(getRowKey ? { getRowKey } : {}),
  });
  const { selectionEnabled, keyOf, selectionSet, allOnPageSelected, toggleRow, toggleAll } =
    selectionApi;
  const enteringKeySet = React.useMemo(() => new Set(enteringRowKeys), [enteringRowKeys]);

  const tbodyRef = React.useRef<HTMLTableSectionElement>(null);
  const keyboard = useDataTableKeyboard<Row>({
    rows,
    ...(onRowClick ? { onRowClick } : {}),
    ...(onEditRow ? { onEditRow } : {}),
    ...(onDeleteRow ? { onDeleteRow } : {}),
    ...(onFocusSearch ? { onFocusSearch } : {}),
    ...(onShowShortcuts ? { onShowShortcuts } : {}),
  });
  const { cursor, setCursor, handleKeyDown } = keyboard;

  const handleHeaderClick = (c: DataTableColumn<Row>) => {
    if (!c.sortable) return;
    const active = sort?.field === c.field;
    const nextDir: "asc" | "desc" = active && sort?.dir === "asc" ? "desc" : "asc";
    onSortChange?.({ field: c.field, dir: nextDir });
  };

  const frame = "rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 shadow-fp-sm overflow-hidden";

  const exportConfig =
    exportable === true
      ? { formats: ["csv"] as ("csv" | "json")[] }
      : exportable
        ? {
            formats: exportable.formats ?? (["csv"] as ("csv" | "json")[]),
            ...(exportable.fields ? { fields: exportable.fields } : {}),
          }
        : null;
  const exportColumns = exportConfig?.fields
    ? (() => {
        const byField = new Map(columns.map((c) => [c.field, c] as const));
        return exportConfig.fields.map(
          (field) =>
            byField.get(field as keyof Row & string) ?? { field: field as keyof Row & string },
        );
      })()
    : orderedVisible;

  const showToolbar =
    Boolean(exportConfig) || Boolean(importable) || showDensityToggle || Boolean(realtimeCfg);
  const toolbar = showToolbar ? (
    <div className="flex items-center justify-end gap-1 border-b border-fp-border-1 bg-fp-bg-1 px-3 py-1.5">
      {/* The row count was only readable at the very bottom of the page, while
          the left half of this bar sat empty. */}
      <span className="mr-auto text-xs tabular-nums text-fp-text-3">
        {total.toLocaleString()} {total === 1 ? "result" : "results"}
      </span>
      {realtimeCfg ? <LiveIndicator status={liveStatus} /> : null}
      {showDensityToggle ? (
        <DensityToggle density={effectiveDensity} onChange={setDensityOverride} />
      ) : null}
      {importable ? (
        <ImportButton
          resource={importable.resource}
          formats={importable.formats}
          label={labels.actions.import}
        />
      ) : null}
      {exportConfig ? (
        <ExportButton
          columns={exportColumns}
          rows={rows}
          formats={exportConfig.formats}
          label={labels.actions.export}
          tableLabel={inlineEditResource ?? emptyTitle ?? "export"}
        />
      ) : null}
    </div>
  ) : null;

  if (loading) {
    return (
      <div className={cn(frame, className)} aria-busy="true">
        {toolbar}
        <DataTableSkeleton
          orderedVisible={orderedVisible}
          pageSize={pageSize}
          rowPadding={rowPadding}
          selectionEnabled={selectionEnabled}
          rowEndCell={rowEndCell}
          rowEndCellLabel={rowEndCellLabel}
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn(frame, className)}>
        {toolbar}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {emptyIcon ? (
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-fp-bg-3/60 text-2xl text-fp-text-2"
              aria-hidden="true"
            >
              {emptyIcon}
            </div>
          ) : null}
          <div className="text-base font-medium text-fp-text-1">{effectiveEmptyTitle}</div>
          {emptyDescription ? (
            <div className="mt-1 text-sm text-fp-text-3">{emptyDescription}</div>
          ) : null}
          {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
        </div>
      </div>
    );
  }

  const showMobileCardView = mobileLayout === "card" && isMobile;

  if (showMobileCardView) {
    return (
      <div className={cn(frame, className)}>
        {toolbar}
        <div className="p-2">
          <MobileCardList
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
          />
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          {...(onPageChange ? { onChange: onPageChange } : {})}
          {...(pageSizeOptions ? { pageSizeOptions } : {})}
          {...(onPageSizeChange ? { onPageSizeChange } : {})}
        />
      </div>
    );
  }

  return (
    <div className={cn(frame, className)}>
      {toolbar}
      <table className="w-full text-sm" aria-rowcount={total + 1}>
        <DataTableHeader
          orderedVisible={orderedVisible}
          sort={sort}
          pinMeta={pinMeta}
          effectiveWidths={effectiveWidths}
          leftPins={leftPins}
          rightPins={rightPins}
          selectionEnabled={selectionEnabled}
          allOnPageSelected={allOnPageSelected}
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
        <tbody
          ref={tbodyRef}
          onKeyDown={handleKeyDown}
          // Land the cursor on the first row, so Enter opens something the moment
          // the table is tabbed to rather than only after an arrow press.
          onFocus={() => setCursor((c) => (c < 0 ? 0 : c))}
          tabIndex={0}
          aria-label="Rows. Arrow keys or j and k move, Enter opens."
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 focus-visible:ring-inset"
        >
          {rows.map((r, idx) => (
            <DataTableRow<Row>
              key={keyOf(r)}
              row={r}
              rowIndex={(page - 1) * pageSize + idx}
              rowKeyValue={keyOf(r)}
              entering={enteringKeySet.has(keyOf(r))}
              rowKey={rowKey}
              active={idx === cursor}
              orderedVisible={orderedVisible}
              pinMeta={pinMeta}
              colIndexByField={colIndexByField}
              {...(prerenderedCells ? { prerenderedCells } : {})}
              rowPadding={rowPadding}
              cellText={cellText}
              selectionEnabled={selectionEnabled}
              selectionSet={selectionSet}
              {...(inlineEditResource ? { inlineEditResource } : {})}
              {...(onRowClick
                ? {
                    onRowClick: (row: Row) => {
                      setCursor(idx);
                      onRowClick(row);
                    },
                  }
                : {})}
              onToggleRow={toggleRow}
              {...(rowEndCell ? { rowEndCell } : {})}
            />
          ))}
        </tbody>
      </table>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        {...(onPageChange ? { onChange: onPageChange } : {})}
        {...(pageSizeOptions ? { pageSizeOptions } : {})}
        {...(onPageSizeChange ? { onPageSizeChange } : {})}
      />
    </div>
  );
}
