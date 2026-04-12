interface TimelineStep {
  step: string;
  durationMs: number;
  status: "succeeded" | "failed" | "running";
}

interface TimelineSectionProps {
  data: Array<TimelineStep>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function TimelineSection({ data }: TimelineSectionProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: "var(--fp-text-4)", fontSize: 12, padding: "8px 0" }}>
        No timeline data
      </div>
    );
  }

  const totalDuration = data.reduce((sum, d) => sum + d.durationMs, 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {data.map((step, i) => {
        const pct = (step.durationMs / totalDuration) * 100;
        const isRunning = step.status === "running";
        const isFailed = step.status === "failed";
        const barColor = isFailed ? "var(--fp-err)" : "var(--fp-accent)";

        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 56px",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* Step name */}
            <span
              style={{
                fontSize: 12,
                color: "var(--fp-text-2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={step.step}
            >
              {step.step}
            </span>

            {/* Bar track */}
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "var(--fp-surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 3,
                  background: barColor,
                  animation: isRunning ? "fp-pulse 1.2s ease-in-out infinite" : undefined,
                }}
              />
            </div>

            {/* Duration text */}
            <span
              style={{
                fontSize: 11,
                color: "var(--fp-text-3)",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatDuration(step.durationMs)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
