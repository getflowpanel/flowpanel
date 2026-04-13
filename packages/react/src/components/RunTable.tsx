import type React from "react";
import { useRef, useState } from "react";
import { useFlowPanel } from "../context";
import { useLocale } from "../locale/LocaleContext";
import { formatDate } from "../utils/formatDate";
import { modKey } from "../utils/platform";
import { StagePill } from "./StagePill";
import { StatusTag } from "./StatusTag";

export interface RunLogColumn {
  field: string;
  label: string;
  width?: number;
  flex?: number;
  mono?: boolean;
  format?: "number" | "currency-usd" | "currency-usd-micro" | "duration" | "date-relative" | "date";
  render?: "statusTag" | "stagePill";
}

interface RunTableProps {
  runs: Record<string, unknown>[];
  columns: RunLogColumn[];
  stageColors: Record<string, string>;
  loading?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  onRowClick?: (run: Record<string, unknown>) => void;
  selectedRunId?: string;
  newRunsBanner?: number;
  onScrollToTop?: () => void;
}

function formatValue(
  value: unknown,
  format: RunLogColumn["format"] | undefined,
  timezone: string,
): string {
  if (value == null) return "\u2014";
  switch (format) {
    case "number":
      return Number(value).toLocaleString();
    case "currency-usd":
      return `$${Number(value).toFixed(4)}`;
    case "currency-usd-micro":
      return `$${Number(value).toFixed(6)}`;
    case "duration":
      return `${(Number(value) / 1000).toFixed(2)}s`;
    case "date-relative":
      return formatDate(String(value), "date-relative", timezone);
    case "date":
      return formatDate(String(value), "date", timezone);
    default:
      return String(value);
  }
}

function Chip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: "err";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: 11,
        borderRadius: 6,
        background: active
          ? color === "err"
            ? "rgba(239,68,68,0.15)"
            : "rgba(255,255,255,0.08)"
          : "transparent",
        border: "1px solid var(--fp-border-1)",
        color: active
          ? color === "err"
            ? "var(--fp-err)"
            : "var(--fp-text-1)"
          : "var(--fp-text-4)",
        cursor: "pointer",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      style={{
        display: "inline-block",
        padding: "1px 5px",
        fontSize: 10,
        background: "var(--fp-surface-3)",
        border: "1px solid var(--fp-border-2)",
        borderRadius: 4,
        fontFamily: "var(--fp-font-mono)",
        color: "var(--fp-text-3)",
        lineHeight: "16px",
      }}
    >
      {children}
    </kbd>
  );
}

const SKELETON_ROWS = 8;

export function RunTable({
  runs,
  columns,
  stageColors,
  loading,
  hasNextPage,
  onLoadMore,
  onRowClick,
  selectedRunId,
  newRunsBanner,
  onScrollToTop,
}: RunTableProps) {
  const { timezone } = useFlowPanel();
  const locale = useLocale();
  const mod = modKey();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const filtered = runs.filter((r) => {
    if (statusFilter && String(r.status) !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        String(r.partition_key ?? "")
          .toLowerCase()
          .includes(q) ||
        String(r.id ?? "")
          .toLowerCase()
          .includes(q)
      );
    }
    return true;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const run = filtered[selectedIndex];
      if (run) onRowClick?.(run);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {/* New runs banner */}
      {newRunsBanner != null && newRunsBanner > 0 && (
        <button
          type="button"
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
            width: "100%",
            border: "none",
          }}
          onClick={onScrollToTop}
          aria-label={locale.newRuns(newRunsBanner)}
        >
          {locale.newRuns(newRunsBanner)}
        </button>
      )}

      {/* Search + filter row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <input
          placeholder={locale.searchPlaceholder}
          data-fp-run-search=""
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: 12,
            background: "var(--fp-surface-2)",
            border: "1px solid var(--fp-border-1)",
            borderRadius: 6,
            color: "var(--fp-text-1)",
            outline: "none",
          }}
        />
        <Chip
          label={locale.statusAll}
          active={statusFilter === null}
          onClick={() => setStatusFilter(null)}
        />
        <Chip
          label={locale.statusRunning}
          active={statusFilter === "running"}
          onClick={() => setStatusFilter("running")}
        />
        <Chip
          label={locale.statusFailed}
          active={statusFilter === "failed"}
          onClick={() => setStatusFilter("failed")}
          color="err"
        />
      </div>

      <table
        ref={tableRef}
        aria-rowcount={filtered.length}
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
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no stable id
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
          ) : filtered.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: 40, textAlign: "center", color: "var(--fp-text-3)" }}
              >
                <div style={{ fontSize: 14 }}>
                  {search || statusFilter ? locale.noMatchTitle : locale.noRunsTitle}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {search || statusFilter ? locale.noMatchDescription : locale.noRunsDescription}
                </div>
              </td>
            </tr>
          ) : (
            filtered.map((run, idx) => {
              const runId = String(run.id);
              const isSelected = selectedRunId === String(run.id) || selectedIndex === idx;
              const stage = String(run.stage ?? "");

              return (
                <tr
                  key={runId}
                  onClick={() => {
                    setSelectedIndex(idx);
                    onRowClick?.(run);
                  }}
                  onMouseEnter={() => setHoveredRow(idx)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? "var(--fp-surface-2)" : undefined,
                    transition: `background var(--fp-duration) ease`,
                  }}
                  aria-selected={isSelected}
                  tabIndex={-1}
                >
                  {columns.map((col, colIdx) => {
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
                          {formatValue(value, col.format, timezone)}
                        </span>
                      );
                    }

                    return (
                      <td
                        key={col.field}
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--fp-border-1)",
                          ...(colIdx === 0 ? { position: "relative" as const } : {}),
                        }}
                      >
                        {colIdx === 0 && (
                          <span
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 2,
                              background: isSelected ? "var(--fp-accent)" : "var(--fp-border-2)",
                              borderRadius: "0 1px 1px 0",
                              opacity: hoveredRow === idx || isSelected ? 1 : 0,
                              transition: "opacity var(--fp-duration) ease",
                            }}
                          />
                        )}
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

      {/* Table footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderTop: "1px solid var(--fp-border-1)",
          fontSize: 11,
          color: "var(--fp-text-4)",
        }}
      >
        <span>{filtered.length.toLocaleString()} runs</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Kbd>j/k</Kbd> navigate <span style={{ margin: "0 2px" }}>&middot;</span>
          <Kbd>Enter</Kbd> open <span style={{ margin: "0 2px" }}>&middot;</span>
          <Kbd>{`${mod}+K`}</Kbd> search
        </span>
      </div>

      {/* Load more */}
      {hasNextPage && !loading && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <button
            type="button"
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
            {locale.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
