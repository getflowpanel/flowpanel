import { useId } from "react";

interface TrendChartProps {
  data: Array<{ label: string; value: number }>;
}

export function TrendChartSection({ data }: TrendChartProps) {
  const gradientId = useId();

  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 280;
  const height = 50;
  const padding = 2;

  const points = data.map((d, i) => ({
    x: padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2),
    y: padding + (1 - d.value / max) * (height - padding * 2),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div
      style={{
        background: "var(--fp-surface-1)",
        border: "1px solid var(--fp-border-1)",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 12,
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fp-accent)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--fp-accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke="var(--fp-accent)" strokeWidth={1.5} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill="var(--fp-accent)" />
        ))}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontSize: 10,
          color: "var(--fp-text-3)",
        }}
      >
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
