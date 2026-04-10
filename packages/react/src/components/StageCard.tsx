import { useState } from "react";

interface StageCardProps {
  stage: string;
  color: string;
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
  selected?: boolean;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
  onRetry?: () => void;
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function StageCard({
  stage,
  color,
  total,
  succeeded,
  failed,
  running,
  avgDurationMs,
  selected,
  loading,
  error,
  onClick,
  onRetry,
}: StageCardProps) {
  if (loading) {
    return (
      <div className="fp-card" aria-busy="true" style={{ padding: 20, minWidth: 140, height: 100 }}>
        <div
          className="fp-skeleton"
          style={{ height: "100%", borderRadius: "var(--fp-radius-lg)" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fp-card" style={{ padding: 20, minWidth: 140 }}>
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

  const [hovered, setHovered] = useState(false);
  const successRate = total > 0 ? Math.round((succeeded / total) * 100) : null;
  const progressRatio = total > 0 ? succeeded / total : 0;

  return (
    <button
      className="fp-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 20,
        minWidth: 140,
        textAlign: "left",
        cursor: "pointer",
        outline: selected ? `2px solid ${color}` : undefined,
        outlineOffset: selected ? 2 : undefined,
        borderColor: hovered ? color : undefined,
        transition:
          "border-color var(--fp-duration-fast) var(--fp-ease-out), background var(--fp-duration) ease",
      }}
      aria-pressed={selected}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--fp-text-2)",
          }}
        >
          {stage}
        </span>
      </div>

      <div
        className="fp-mono"
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: "var(--fp-text-1)",
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {total > 0 ? total.toLocaleString() : "—"}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div
          style={{
            height: 2,
            background: "var(--fp-surface-3)",
            borderRadius: 1,
            marginBottom: 8,
            overflow: "hidden",
          }}
          role="progressbar"
          aria-valuenow={succeeded}
          aria-valuemax={total}
        >
          <div
            style={{
              height: "100%",
              width: `${progressRatio * 100}%`,
              background: color,
              borderRadius: 1,
              transition: "width var(--fp-duration-normal) var(--fp-ease-out)",
            }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          fontSize: 11,
          color: "var(--fp-text-3)",
          alignItems: "center",
        }}
      >
        {failed > 0 && <span style={{ color: "var(--fp-err)" }}>{failed} failed</span>}
        {running > 0 && (
          <span
            style={{
              color: "var(--fp-warn)",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--fp-warn)",
                animation: "fp-pulse 1.6s ease-in-out infinite",
              }}
              aria-hidden
            />
            {running} running
          </span>
        )}
        {successRate !== null && <span>{successRate}% ok</span>}
        {avgDurationMs !== null && <span>avg {formatDuration(avgDurationMs)}</span>}
      </div>
    </button>
  );
}
