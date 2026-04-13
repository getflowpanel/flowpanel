import { useState } from "react";

interface ErrorPanelProps {
  errors: Array<{ errorClass: string; count: number; lastSeen?: string }>;
  totalFailed: number;
  loading?: boolean;
  onRetryAll?: () => void;
  onErrorClick?: (errorClass: string) => void;
}

export function ErrorPanel({
  errors,
  totalFailed,
  loading,
  onRetryAll,
  onErrorClick,
}: ErrorPanelProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  if (totalFailed === 0 && !loading) {
    return null;
  }

  const visibleErrors = errors.slice(0, 5);
  const maxCount = visibleErrors.reduce((acc, e) => Math.max(acc, e.count), 1);

  return (
    <section
      style={{
        background: "var(--fp-surface-1, var(--fp-surface-2))",
        border: "1px solid var(--fp-border-1)",
        borderRadius: "var(--fp-radius-sm)",
        overflow: "hidden",
      }}
      aria-label="Error summary"
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: visibleErrors.length > 0 ? "1px solid var(--fp-border-1)" : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--fp-warn)",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 13 }}>
            ⚠
          </span>
          <span>
            {loading && totalFailed === 0
              ? "Loading…"
              : `${totalFailed} failed run${totalFailed === 1 ? "" : "s"} · top errors`}
          </span>
        </div>

        {onRetryAll && (
          <button
            type="button"
            onClick={onRetryAll}
            style={{
              background: "transparent",
              border: "1px solid color-mix(in srgb, var(--fp-err) 30%, transparent)",
              borderRadius: "var(--fp-radius-sm)",
              color: "var(--fp-err)",
              fontSize: 11,
              fontWeight: 500,
              padding: "3px 10px",
              cursor: "pointer",
              lineHeight: 1.4,
              transition: "opacity var(--fp-duration, 150ms)",
            }}
            aria-label="Retry all failed runs"
          >
            Retry all
          </button>
        )}
      </div>

      {/* Error rows */}
      {visibleErrors.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {visibleErrors.map((error, i) => {
            const barWidth = (error.count / maxCount) * 100;
            const isHovered = hoveredRow === i;

            return (
              <li
                key={error.errorClass}
                onClick={() => onErrorClick?.(error.errorClass)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onErrorClick?.(error.errorClass);
                }}
                tabIndex={onErrorClick ? 0 : undefined}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 14px",
                  cursor: onErrorClick ? "pointer" : "default",
                  background: isHovered ? "var(--fp-surface-2)" : "transparent",
                  transition: "background var(--fp-duration, 150ms)",
                  borderBottom:
                    i < visibleErrors.length - 1 ? "1px solid var(--fp-border-1)" : undefined,
                }}
                aria-label={`${error.errorClass}: ${error.count} occurrence${error.count === 1 ? "" : "s"}`}
              >
                {/* Error class label */}
                <div
                  style={{
                    flex: "0 0 auto",
                    minWidth: 0,
                    maxWidth: "40%",
                    fontSize: 12,
                    fontFamily: "var(--fp-font-mono)",
                    color: "var(--fp-text-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={error.errorClass}
                >
                  {error.errorClass}
                </div>

                {/* Proportional bar */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 4,
                    borderRadius: 2,
                    background: "color-mix(in srgb, var(--fp-err) 10%, transparent)",
                    overflow: "hidden",
                  }}
                  aria-hidden="true"
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${barWidth}%`,
                      borderRadius: 2,
                      background: "color-mix(in srgb, var(--fp-err) 40%, transparent)",
                      transition: "width var(--fp-duration, 150ms)",
                    }}
                  />
                </div>

                {/* Count badge */}
                <div
                  style={{
                    flex: "0 0 auto",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--fp-err)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {error.count}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
