import React from "react";
import { Tooltip } from "./Tooltip.js";

interface StageCardProps {
  stage: string;
  color: string;
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
  totalAllStages: number;
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
  totalAllStages,
  selected,
  loading,
  onClick,
}: StageCardProps) {
  if (loading) {
    return (
      <div className="fp-card" aria-busy="true" style={{ padding: 20, minWidth: 140, height: 100 }}>
        <div
          className="fp-skeleton"
          style={{ height: "100%", borderRadius: "var(--fp-radius-sm)" }}
        />
      </div>
    );
  }

  const pct = totalAllStages > 0 ? ((total / totalAllStages) * 100).toFixed(0) : "0";
  const dur =
    avgDurationMs != null
      ? avgDurationMs < 1000
        ? `${Math.round(avgDurationMs)}ms`
        : `${(avgDurationMs / 1000).toFixed(1)}s`
      : "—";
  const rate = total > 0 ? ((succeeded / total) * 100).toFixed(0) : "—";

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
        outlineOffset: selected ? -2 : undefined,
      }}
      aria-pressed={selected}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        style={{
          width: "100%",
          height: 2,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 1,
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: `${totalAllStages > 0 ? (total / totalAllStages) * 100 : 0}%`,
            height: "100%",
            background: color,
            opacity: 0.6,
            borderRadius: 1,
          }}
        />
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
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 11, color: "var(--fp-text-3)" }}>
          {pct}% of runs · avg {dur} · {rate}% ok
        </div>
        {failed > 0 && (
          <span style={{ fontSize: 11, color: "var(--fp-err)" }}>{failed} failed</span>
        )}
        {running > 0 && (
          <Tooltip content="Currently executing">
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 11,
                color: "var(--fp-text-2)",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: color,
                  animation: "fp-pulse 1.6s ease-in-out infinite",
                }}
              />
              {running} running
            </span>
          </Tooltip>
        )}
      </div>
    </button>
  );
}
