"use client";
import type { CSSProperties } from "react";

/** Stands in for a chart until it mounts, in the chart's own box, so the server-rendered page reserves the space. */
export function ChartSkeleton({ style }: { style: CSSProperties }) {
  return (
    <div
      className="fp-w-full fp-animate-pulse fp-rounded fp-bg-canvas"
      style={style}
      aria-hidden="true"
    />
  );
}
