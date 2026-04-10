interface ErrorPanelProps {
  errors: Array<{ errorClass: string; count: number }>;
  totalFailed: number;
  totalRuns: number;
  loading?: boolean;
  error?: string;
  onErrorClick?: (errorClass: string) => void;
  onRetry?: () => void;
}

export function ErrorPanel({
  errors,
  totalFailed,
  totalRuns,
  loading,
  error,
  onErrorClick,
  onRetry,
}: ErrorPanelProps) {
  if (loading) {
    return (
      <div className="fp-card" style={{ padding: 20 }} aria-busy="true" aria-label="Loading errors">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="fp-skeleton"
            style={{ height: 28, marginBottom: 8, borderRadius: 6 }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="fp-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, color: "var(--fp-err)", marginBottom: 8 }}>{error}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 4,
              background: "var(--fp-surface-2)",
              border: "1px solid var(--fp-border-1)",
              color: "var(--fp-text-2)",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div
        className="fp-card"
        style={{
          padding: "24px 20px",
          textAlign: "center",
          color: "var(--fp-text-3)",
          fontSize: 13,
        }}
      >
        No errors in this period
      </div>
    );
  }

  const errorRate = totalRuns > 0 ? Math.round((totalFailed / totalRuns) * 100) : 0;
  const maxCount = Math.max(...errors.map((e) => e.count), 1);

  return (
    <div className="fp-card" style={{ padding: 20 }}>
      {errorRate > 10 && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: 12,
            borderRadius: 6,
            background: "rgba(245, 158, 11, 0.12)",
            color: "var(--fp-warn)",
            fontSize: 12,
            fontWeight: 600,
          }}
          role="alert"
        >
          {errorRate}% error rate
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {errors.map((err) => {
          const ratio = err.count / maxCount;
          return (
            <div
              key={err.errorClass}
              onClick={() => onErrorClick?.(err.errorClass)}
              style={{
                position: "relative",
                padding: "8px 12px",
                borderRadius: 6,
                cursor: onErrorClick ? "pointer" : undefined,
                overflow: "hidden",
                transition: "background var(--fp-duration) ease",
              }}
              role={onErrorClick ? "button" : undefined}
              tabIndex={onErrorClick ? 0 : undefined}
              onKeyDown={
                onErrorClick ? (e) => e.key === "Enter" && onErrorClick(err.errorClass) : undefined
              }
            >
              {/* Background bar */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${ratio * 100}%`,
                  background: "rgba(239, 68, 68, 0.2)",
                  borderRadius: 6,
                  transition: "width var(--fp-duration-normal) var(--fp-ease-out)",
                }}
                aria-hidden
              />
              {/* Content */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--fp-err)", fontWeight: 500 }}>
                  {err.errorClass}
                </span>
                <span
                  className="fp-mono"
                  style={{ fontSize: 11, color: "var(--fp-text-2)", fontWeight: 600 }}
                >
                  {err.count}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
