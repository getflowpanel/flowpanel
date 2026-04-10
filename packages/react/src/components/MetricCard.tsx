interface MetricCardProps {
  label: string;
  value: string | number | null;
  trend?: string;
  sublabel?: string;
  loading?: boolean;
  onClick?: () => void;
  hasDrawer?: boolean;
  expanded?: boolean;
}

export function MetricCard({
  label,
  value,
  trend,
  sublabel,
  loading,
  onClick,
  hasDrawer,
  expanded,
}: MetricCardProps) {
  if (loading) {
    return (
      <div
        className="fp-card"
        style={{ padding: "20px 24px", minWidth: 160 }}
        aria-busy="true"
        aria-label="Loading metric"
      >
        <div className="fp-skeleton" style={{ height: 11, width: "60%", marginBottom: 12 }} />
        <div className="fp-skeleton" style={{ height: 28, width: "80%", marginBottom: 8 }} />
        <div className="fp-skeleton" style={{ height: 10, width: "40%" }} />
      </div>
    );
  }

  const isClickable = !!onClick && !!hasDrawer;

  if (isClickable) {
    return (
      <button
        className="fp-card"
        style={{
          padding: "20px 24px",
          minWidth: 160,
          cursor: "pointer",
          textAlign: "left",
          border: "1px solid var(--fp-border-1)",
        }}
        onClick={onClick}
        aria-expanded={expanded ?? false}
        aria-haspopup="dialog"
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--fp-text-2)",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
        <div
          className="fp-mono"
          style={{ fontSize: 28, fontWeight: 700, color: "var(--fp-text-1)", lineHeight: 1 }}
        >
          {value ?? "—"}
        </div>
        {(trend || sublabel) && (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--fp-text-3)" }}>
            {trend && (
              <span style={{ color: trend.startsWith("+") ? "var(--fp-ok)" : "var(--fp-err)" }}>
                {trend}
              </span>
            )}
            {sublabel && <span style={{ marginLeft: trend ? 6 : 0 }}>{sublabel}</span>}
          </div>
        )}
      </button>
    );
  }

  return (
    <div
      className="fp-card"
      style={{
        padding: "20px 24px",
        minWidth: 160,
        textAlign: "left",
        border: "1px solid var(--fp-border-1)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--fp-text-2)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="fp-mono"
        style={{ fontSize: 28, fontWeight: 700, color: "var(--fp-text-1)", lineHeight: 1 }}
      >
        {value ?? "—"}
      </div>
      {(trend || sublabel) && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--fp-text-3)" }}>
          {trend && (
            <span style={{ color: trend.startsWith("+") ? "var(--fp-ok)" : "var(--fp-err)" }}>
              {trend}
            </span>
          )}
          {sublabel && <span style={{ marginLeft: trend ? 6 : 0 }}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
