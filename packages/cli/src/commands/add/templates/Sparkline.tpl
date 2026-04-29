"use client";

/**
 * Sparkline — dependency-free inline SVG line chart. Edit freely.
 *
 * Designed for tucking into a stat card or row. No axes, no legend —
 * a single stroke that conveys trend shape. Pair it with a bigger
 * numeric value for the "what" and let the sparkline show the "when".
 */

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** CSS color. Defaults to currentColor so it inherits from the parent. */
  color?: string;
  /** Optional fill under the line (e.g. "rgb(16 185 129 / 0.15)"). */
  fill?: string;
  strokeWidth?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color,
  fill,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  if (data.length === 0) return null;
  const pad = 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;

  const pts = data
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");

  const area =
    fill !== undefined
      ? "M " + pad + "," + (height - pad) + " L " + pts.replaceAll(" ", " L ") + " L " + (pad + (data.length - 1) * stepX) + "," + (height - pad) + " Z"
      : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "block"}
      role="img"
      aria-label="sparkline"
    >
      {area && <path d={area} fill={fill} stroke="none" />}
      <polyline
        fill="none"
        stroke={color ?? "currentColor"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}
