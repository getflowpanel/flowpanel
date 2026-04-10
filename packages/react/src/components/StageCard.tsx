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
  onClick?: () => void;
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
  onClick,
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

  const successRate = total > 0 ? Math.round((succeeded / total) * 100) : null;

  return (
    <button
      className="fp-card"
      onClick={onClick}
      style={{
        padding: 20,
        minWidth: 140,
        textAlign: "left",
        cursor: "pointer",
        outline: selected ? `2px solid ${color}` : undefined,
        outlineOffset: selected ? 2 : undefined,
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
      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--fp-text-3)" }}>
        {failed > 0 && <span style={{ color: "var(--fp-err)" }}>{failed} failed</span>}
        {running > 0 && <span style={{ color: "var(--fp-warn)" }}>{running} running</span>}
        {successRate !== null && <span>{successRate}% ok</span>}
        {avgDurationMs !== null && (
          <span>
            avg{" "}
            {avgDurationMs >= 1000 ? `${(avgDurationMs / 1000).toFixed(1)}s` : `${avgDurationMs}ms`}
          </span>
        )}
      </div>
    </button>
  );
}
