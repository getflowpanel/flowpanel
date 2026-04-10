import type React from "react";
import { useEffect, useRef, useState } from "react";
import { StagePill } from "./StagePill.js";
import { StatusTag } from "./StatusTag.js";

export interface RunLogColumn {
  field: string;
  label: string;
  width?: number;
  flex?: number;
  mono?: boolean;
  format?: "number" | "currency-usd" | "currency-usd-micro" | "duration" | "date-relative";
  render?: "statusTag" | "stagePill";
}

interface RunTableProps {
  runs: Record<string, unknown>[];
  columns: RunLogColumn[];
  stageColors: Record<string, string>;
  loading?: boolean;
  error?: string;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  onRowClick?: (run: Record<string, unknown>) => void;
  selectedRunId?: string;
  newRunsBanner?: number;
  onScrollToTop?: () => void;
  onSearch?: (query: string) => void;
  onStatusFilter?: (status: string | null) => void;
  activeStatusFilter?: string | null;
  onRetry?: () => void;
}

function formatValue(value: unknown, format?: RunLogColumn["format"]): string {
  if (value == null) return "—";
  switch (format) {
    case "number":
      return Number(value).toLocaleString();
    case "currency-usd":
      return `$${Number(value).toFixed(4)}`;
    case "currency-usd-micro":
      return `$${Number(value).toFixed(6)}`;
    case "duration":
      return `${(Number(value) / 1000).toFixed(2)}s`;
    case "date-relative": {
      const diff = Date.now() - new Date(String(value)).getTime();
      if (diff < 60_000) return "just now";
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
      return `${Math.floor(diff / 86_400_000)}d ago`;
    }
    default:
      return String(value);
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "succeeded":
      return "var(--fp-ok)";
    case "failed":
      return "var(--fp-err)";
    case "running":
      return "var(--fp-warn)";
    default:
      return "var(--fp-text-3)";
  }
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  fontSize: 10,
  fontFamily: "var(--fp-font-mono)",
  background: "var(--fp-surface-3)",
  borderRadius: 3,
  border: "1px solid var(--fp-border-1)",
  color: "var(--fp-text-3)",
  lineHeight: 1.4,
};

const STATUS_FILTERS = ["All", "Running", "Failed", "Succeeded"] as const;

const SKELETON_ROWS = 8;

export function RunTable({
  runs,
  columns,
  stageColors,
  loading,
  error,
  hasNextPage,
  onLoadMore,
  onRowClick,
  selectedRunId,
  newRunsBanner,
  onScrollToTop,
  onSearch,
  onStatusFilter,
  activeStatusFilter,
  onRetry,
}: RunTableProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const tableRef = useRef<HTMLTableElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!onSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(searchValue);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue, onSearch]);

  // Responsive horizontal scroll
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const mq = window.matchMedia("(max-width: 640px)");
    function apply() {
      if (el) el.style.overflowX = mq.matches ? "auto" : "visible";
    }
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Keyboard navigation (j/k/Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, runs.length - 1));
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const run = runs[selectedIndex];
      if (run) onRowClick?.(run);
    }
  };

  const hasFilters = activeStatusFilter != null || searchValue.trim() !== "";

  return (
    <div style={{ position: "relative" }}>
      {/* Search + filter bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 12px 0",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {onSearch && (
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search runs..."
            aria-label="Search runs"
            style={{
              padding: "6px 10px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--fp-border-1)",
              background: "var(--fp-surface-2)",
              color: "var(--fp-text-1)",
              outline: "none",
              minWidth: 160,
              boxSizing: "border-box",
            }}
          />
        )}
        {onStatusFilter && (
          <div role="group" aria-label="Status filter" style={{ display: "flex", gap: 4 }}>
            {STATUS_FILTERS.map((f) => {
              const filterVal = f === "All" ? null : f.toLowerCase();
              const active =
                f === "All" ? activeStatusFilter == null : activeStatusFilter === filterVal;
              return (
                <button
                  key={f}
                  onClick={() => onStatusFilter(filterVal)}
                  aria-pressed={active}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    borderRadius: 12,
                    border: "1px solid var(--fp-border-1)",
                    background: active ? "var(--fp-accent-dim)" : "transparent",
                    color: active ? "var(--fp-accent-text)" : "var(--fp-text-3)",
                    cursor: "pointer",
                    fontWeight: active ? 600 : 400,
                    transition: "background var(--fp-duration) ease",
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* New runs banner */}
      {newRunsBanner != null && newRunsBanner > 0 && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "var(--fp-accent-dim)",
            color: "var(--fp-accent-text)",
            padding: "8px 16px",
            textAlign: "center",
            cursor: "pointer",
            fontSize: 13,
          }}
          onClick={onScrollToTop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onScrollToTop?.()}
          aria-label={`${newRunsBanner} new run${newRunsBanner > 1 ? "s" : ""} — click to scroll to top`}
        >
          {newRunsBanner} new run{newRunsBanner > 1 ? "s" : ""} — scroll to top to see
        </div>
      )}

      <div ref={wrapperRef}>
        <table
          ref={tableRef}
          aria-rowcount={runs.length}
          aria-colcount={columns.length}
          aria-label="Pipeline runs"
          style={{ width: "100%", borderCollapse: "collapse" }}
          onKeyDown={handleKeyDown}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.field}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--fp-text-3)",
                    borderBottom: "1px solid var(--fp-border-1)",
                    width: col.width,
                  }}
                  scope="col"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} aria-busy="true">
                  {columns.map((col) => (
                    <td key={col.field} style={{ padding: "10px 12px" }}>
                      <span
                        className="fp-skeleton"
                        style={{
                          display: "inline-block",
                          width: col.mono ? "5ch" : "80%",
                          height: 12,
                          borderRadius: 4,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: 40, textAlign: "center", color: "var(--fp-err)" }}
                >
                  <div style={{ fontSize: 14, marginBottom: 8 }}>{error}</div>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        borderRadius: 6,
                        background: "var(--fp-surface-2)",
                        border: "1px solid var(--fp-border-1)",
                        color: "var(--fp-text-2)",
                        cursor: "pointer",
                      }}
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: 40, textAlign: "center", color: "var(--fp-text-3)" }}
                >
                  <div style={{ fontSize: 14 }}>
                    {hasFilters ? "No runs match current filters" : "No runs yet"}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {hasFilters
                      ? "Try changing the search query or status filter."
                      : "Add withRun() to your workers to start tracking pipeline runs."}
                  </div>
                </td>
              </tr>
            ) : (
              runs.map((run, idx) => {
                const runId = String(run.id);
                const isSelected = selectedRunId === runId || selectedIndex === idx;
                const stage = String(run.stage ?? "");
                const runStatus = String(run.status ?? "");

                return (
                  <tr
                    key={runId}
                    onClick={() => {
                      setSelectedIndex(idx);
                      onRowClick?.(run);
                    }}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "var(--fp-surface-2)" : undefined,
                      transition: `background var(--fp-duration) ease`,
                      borderLeft: "3px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderLeft =
                        `3px solid ${statusColor(runStatus)}`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderLeft = "3px solid transparent";
                    }}
                    aria-selected={isSelected}
                    tabIndex={-1}
                  >
                    {columns.map((col) => {
                      const value = run[col.field];

                      let cell: React.ReactNode;
                      if (col.render === "statusTag") {
                        cell = (
                          <StatusTag status={run.status as "running" | "succeeded" | "failed"} />
                        );
                      } else if (col.render === "stagePill") {
                        cell = <StagePill stage={stage} color={stageColors[stage] ?? "#818cf8"} />;
                      } else {
                        cell = (
                          <span
                            className={col.mono ? "fp-mono" : undefined}
                            style={{ fontSize: col.mono ? 11 : 12 }}
                          >
                            {formatValue(value, col.format)}
                          </span>
                        );
                      }

                      return (
                        <td
                          key={col.field}
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid var(--fp-border-1)",
                          }}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasNextPage && !loading && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <button
            onClick={onLoadMore}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              background: "var(--fp-surface-2)",
              border: "1px solid var(--fp-border-1)",
              color: "var(--fp-text-2)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Load 50 more
          </button>
        </div>
      )}

      {/* Footer with keyboard hints */}
      {runs.length > 0 && !loading && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--fp-border-1)",
            display: "flex",
            gap: 12,
            fontSize: 11,
            color: "var(--fp-text-3)",
          }}
        >
          <span>
            <kbd style={kbdStyle}>j</kbd>/<kbd style={kbdStyle}>k</kbd> navigate
          </span>
          <span>
            <kbd style={kbdStyle}>↵</kbd> open
          </span>
          <span>
            <kbd style={kbdStyle}>?</kbd> help
          </span>
        </div>
      )}
    </div>
  );
}
