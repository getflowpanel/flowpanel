export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  stroke = "currentColor",
  fill,
  className,
}: SparklineProps) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = (i * step).toFixed(1);
    const y = (height - ((v - min) / range) * height).toFixed(1);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  });
  const d = points.join(" ");
  const fillD = fill ? `${d} L${width},${height} L0,${height} Z` : undefined;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="trend"
      className={className}
    >
      {fillD ? <path d={fillD} fill={fill} stroke="none" /> : null}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
