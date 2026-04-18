import { useId } from "react";

interface TrendChartSectionProps {
  data: Array<{ bucket: string; value: number }>;
}

const WIDTH = 280;
const HEIGHT = 50;

export function TrendChartSection({ data }: TrendChartSectionProps) {
  const gradientId = useId();

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fp-text-4)",
          fontSize: 12,
        }}
      >
        No data
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const n = data.length;
  const xStep = WIDTH / Math.max(n - 1, 1);

  const points = data.map((d, i) => ({
    x: i * xStep,
    y: HEIGHT - ((d.value - minVal) / range) * (HEIGHT - 6) - 3,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Area path: start from bottom-left, line through points, end at bottom-right
  const areaPath = `M 0,${HEIGHT} ${points.map((p) => `L ${p.x},${p.y}`).join(" ")} L ${WIDTH},${HEIGHT} Z`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Trend chart"
      width="100%"
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--fp-accent)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--fp-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradientId})`} />

      {/* Stroke line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--fp-accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
