import { useId, useMemo, useRef, useState, type MouseEvent } from "react";

export interface RunChartProps {
  buckets: Array<{ label: string; total: number; succeeded: number; failed: number }>;
  peakBucket?: number;
  loading?: boolean;
  error?: string;
}

const W = 760;
const H = 120;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 6;
const PAD_BOTTOM = 18;
const CHART_W = W - PAD_LEFT - PAD_RIGHT;
const CHART_H = H - PAD_TOP - PAD_BOTTOM;

type Series = "succeeded" | "failed";

const SERIES_META: Record<Series, { color: string; label: string }> = {
  succeeded: { color: "#22c55e", label: "Succeeded" },
  failed: { color: "#ef4444", label: "Failed" },
};

function buildAreaPath(
  values: number[],
  max: number,
  chartW: number,
  chartH: number,
  padLeft: number,
  padTop: number,
): string {
  if (values.length === 0) return "";
  const step = values.length === 1 ? chartW : chartW / (values.length - 1);
  const baseline = padTop + chartH;

  const points = values.map((v, i) => {
    const x = padLeft + i * step;
    const y = max === 0 ? baseline : baseline - (v / max) * chartH;
    return `${x},${y}`;
  });

  const lastX = padLeft + (values.length - 1) * step;
  return `M${padLeft},${baseline} L${points.join(" L")} L${lastX},${baseline} Z`;
}

export function RunChart({ buckets, peakBucket, loading, error }: RunChartProps) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<Series>>(() => new Set());

  const max = useMemo(() => {
    if (buckets.length === 0) return 0;
    return Math.max(...buckets.map((b) => b.total), 1);
  }, [buckets]);

  const midLabel = Math.round(max / 2);

  const succeededValues = useMemo(() => buckets.map((b) => b.succeeded), [buckets]);
  const failedValues = useMemo(() => buckets.map((b) => b.failed), [buckets]);

  const succeededPath = useMemo(
    () => buildAreaPath(succeededValues, max, CHART_W, CHART_H, PAD_LEFT, PAD_TOP),
    [succeededValues, max],
  );
  const failedPath = useMemo(
    () => buildAreaPath(failedValues, max, CHART_W, CHART_H, PAD_LEFT, PAD_TOP),
    [failedValues, max],
  );

  const labelStep = useMemo(() => {
    if (buckets.length <= 8) return 1;
    if (buckets.length <= 16) return 2;
    if (buckets.length <= 32) return 4;
    return Math.ceil(buckets.length / 8);
  }, [buckets.length]);

  function toggleSeries(s: Series) {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || buckets.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const ratioX = (e.clientX - rect.left) / rect.width;
    const svgX = ratioX * W;
    const step = buckets.length === 1 ? CHART_W : CHART_W / (buckets.length - 1);
    const idx = Math.round((svgX - PAD_LEFT) / step);
    const clamped = Math.max(0, Math.min(buckets.length - 1, idx));
    setHoverIndex(clamped);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function handleMouseLeave() {
    setHoverIndex(null);
    setTooltipPos(null);
  }

  if (loading) {
    return (
      <div
        className="fp-card"
        style={{
          background: "var(--fp-surface-1)",
          border: "1px solid var(--fp-border-1)",
          borderRadius: 8,
          padding: 16,
        }}
        aria-busy="true"
        aria-label="Loading chart"
      >
        <div className="fp-skeleton" style={{ width: "100%", height: 120, borderRadius: 4 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="fp-card"
        style={{
          background: "var(--fp-surface-1)",
          border: "1px solid var(--fp-border-1)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 120,
            fontSize: 13,
            color: "var(--fp-err, #ef4444)",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div
        className="fp-card"
        style={{
          background: "var(--fp-surface-1)",
          border: "1px solid var(--fp-border-1)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 120,
            fontSize: 13,
            color: "var(--fp-text-3)",
          }}
        >
          No data for this time range
        </div>
      </div>
    );
  }

  const step = buckets.length === 1 ? CHART_W : CHART_W / (buckets.length - 1);
  const hoverBucket = hoverIndex != null ? buckets[hoverIndex] : null;
  const hoverX = hoverIndex != null ? PAD_LEFT + hoverIndex * step : null;
  const peakX =
    peakBucket != null && peakBucket >= 0 && peakBucket < buckets.length
      ? PAD_LEFT + peakBucket * step
      : null;

  return (
    <div
      className="fp-card"
      style={{
        background: "var(--fp-surface-1)",
        border: "1px solid var(--fp-border-1)",
        borderRadius: 8,
        padding: 16,
        position: "relative",
      }}
    >
      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block", cursor: "crosshair" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          aria-label="Run chart"
          role="img"
        >
          <defs>
            <linearGradient id={`${gradientId}-green`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id={`${gradientId}-red`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={PAD_LEFT}
            y1={PAD_TOP + CHART_H / 3}
            x2={W - PAD_RIGHT}
            y2={PAD_TOP + CHART_H / 3}
            stroke="var(--fp-border-1)"
            strokeDasharray="4 3"
            strokeWidth={0.5}
          />
          <line
            x1={PAD_LEFT}
            y1={PAD_TOP + (CHART_H * 2) / 3}
            x2={W - PAD_RIGHT}
            y2={PAD_TOP + (CHART_H * 2) / 3}
            stroke="var(--fp-border-1)"
            strokeDasharray="4 3"
            strokeWidth={0.5}
          />

          {/* Y-axis labels */}
          <text
            x={PAD_LEFT - 4}
            y={PAD_TOP + 4}
            textAnchor="end"
            fontSize={9}
            fill="var(--fp-text-3)"
          >
            {max}
          </text>
          <text
            x={PAD_LEFT - 4}
            y={PAD_TOP + CHART_H / 2 + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--fp-text-3)"
          >
            {midLabel}
          </text>
          <text
            x={PAD_LEFT - 4}
            y={PAD_TOP + CHART_H + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--fp-text-3)"
          >
            0
          </text>

          {/* Area paths */}
          {!hiddenSeries.has("succeeded") && (
            <path d={succeededPath} fill={`url(#${gradientId}-green)`} />
          )}
          {!hiddenSeries.has("failed") && <path d={failedPath} fill={`url(#${gradientId}-red)`} />}

          {/* Peak marker */}
          {peakX != null && (
            <>
              <line
                x1={peakX}
                y1={PAD_TOP}
                x2={peakX}
                y2={PAD_TOP + CHART_H}
                stroke="var(--fp-text-3)"
                strokeDasharray="3 2"
                strokeWidth={0.75}
              />
              <text
                x={peakX}
                y={PAD_TOP - 1}
                textAnchor="middle"
                fontSize={8}
                fill="var(--fp-text-3)"
              >
                peak
              </text>
            </>
          )}

          {/* Hover crosshair */}
          {hoverX != null && (
            <line
              x1={hoverX}
              y1={PAD_TOP}
              x2={hoverX}
              y2={PAD_TOP + CHART_H}
              stroke="var(--fp-text-2)"
              strokeWidth={0.75}
            />
          )}

          {/* X-axis labels */}
          {buckets.map((b, i) => {
            if (i % labelStep !== 0) return null;
            const x = PAD_LEFT + i * step;
            return (
              <text
                key={i}
                x={x}
                y={H - 2}
                textAnchor="middle"
                fontSize={9}
                fill="var(--fp-text-3)"
              >
                {b.label}
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoverBucket && tooltipPos && (
          <div
            style={{
              position: "absolute",
              left: tooltipPos.x,
              top: tooltipPos.y - 52,
              transform: "translateX(-50%)",
              background: "var(--fp-surface-1)",
              border: "1px solid var(--fp-border-1)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 11,
              color: "var(--fp-text-1)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 10,
              fontFamily: "var(--fp-font-mono)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{hoverBucket.label}</div>
            <div>
              <span style={{ color: "#22c55e" }}>●</span> {hoverBucket.succeeded}
              <span style={{ marginLeft: 8, color: "#ef4444" }}>●</span> {hoverBucket.failed}
              <span style={{ marginLeft: 8, color: "var(--fp-text-3)" }}>
                Σ {hoverBucket.total}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {(Object.keys(SERIES_META) as Series[]).map((s) => {
          const meta = SERIES_META[s];
          const hidden = hiddenSeries.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleSeries(s)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                fontSize: 11,
                borderRadius: 9999,
                border: "1px solid var(--fp-border-1)",
                background: hidden ? "transparent" : "var(--fp-surface-1)",
                color: hidden ? "var(--fp-text-3)" : "var(--fp-text-1)",
                cursor: "pointer",
                opacity: hidden ? 0.5 : 1,
                transition: "opacity 150ms",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: hidden ? "var(--fp-text-3)" : meta.color,
                  display: "inline-block",
                }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
