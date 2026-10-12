"use client";

/** Stands in for a chart until it mounts, at the chart's own height, so the
    server-rendered page reserves the space instead of showing an empty frame. */
export function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="fp-w-full fp-animate-pulse fp-rounded fp-bg-canvas"
      style={{ height }}
      aria-hidden="true"
    />
  );
}
