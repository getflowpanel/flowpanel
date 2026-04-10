import { useState } from "react";

interface MetricCardProps {
  label: string;
  value: string | number | null;
  trend?: string;
  sublabel?: string;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
  hasDrawer?: boolean;
  expanded?: boolean;
  sparkline?: number[];
  sparklineColor?: string;
  onRetry?: () => void;
}

function Sparkline({ data, color }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const barColor = color ?? "var(--fp-accent)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height: 22,
        marginTop: 8,
      }}
      aria-hidden
    >
      {data.slice(0, 7).map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max((v / max) * 100, 4)}%`,
            background: barColor,
            borderRadius: 2,
            minWidth: 4,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

const cardBaseStyle = {
  padding: "20px 24px",
  minWidth: 160,
  textAlign: "left" as const,
  border: "1px solid var(--fp-border-1)",
  transition:
    "transform var(--fp-duration-fast) var(--fp-ease-out), box-shadow var(--fp-duration-fast) var(--fp-ease-out)",
};

function CardContent({
  label,
  value,
  sparkline,
  sparklineColor,
  trend,
  sublabel,
}: Pick<
  MetricCardProps,
  "label" | "value" | "trend" | "sublabel" | "sparkline" | "sparklineColor"
>) {
  return (
    <>
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
      {sparkline && sparkline.length > 0 && <Sparkline data={sparkline} color={sparklineColor} />}
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
    </>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  sublabel,
  loading,
  error,
  onClick,
  hasDrawer,
  expanded,
  sparkline,
  sparklineColor,
  onRetry,
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

  if (error) {
    return (
      <div className="fp-card" style={{ padding: "20px 24px", minWidth: 160 }}>
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
  const isClickable = !!onClick && !!hasDrawer;

  const hoverStyle = hovered
    ? { transform: "translateY(-1px)", boxShadow: "var(--fp-shadow-md)" }
    : {};
  const hoverHandlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (isClickable) {
    return (
      <button
        className="fp-card"
        style={{
          ...cardBaseStyle,
          ...hoverStyle,
          cursor: "pointer",
        }}
        onClick={onClick}
        aria-expanded={expanded ?? false}
        aria-haspopup="dialog"
        {...hoverHandlers}
      >
        <CardContent
          label={label}
          value={value}
          sparkline={sparkline}
          sparklineColor={sparklineColor}
          trend={trend}
          sublabel={sublabel}
        />
      </button>
    );
  }

  return (
    <div className="fp-card" style={{ ...cardBaseStyle, ...hoverStyle }} {...hoverHandlers}>
      <CardContent
        label={label}
        value={value}
        sparkline={sparkline}
        sparklineColor={sparklineColor}
        trend={trend}
        sublabel={sublabel}
      />
    </div>
  );
}
