interface TimelineProps {
  data: Array<{ step: string; durationMs: number; status: string }>;
}

const statusColorMap: Record<string, string> = {
  succeeded: "#22c55e",
  failed: "#ef4444",
  running: "#3b82f6",
};

function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function TimelineSection({ data }: TimelineProps) {
  if (data.length === 0) return null;

  const maxDuration = Math.max(...data.map((d) => d.durationMs), 1);

  return (
    <div
      style={{
        background: "var(--fp-surface-1)",
        border: "1px solid var(--fp-border-1)",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <style>
        {`@keyframes fp-timeline-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }`}
      </style>
      {data.map((item, i) => {
        const color = statusColorMap[item.status] ?? "var(--fp-text-3)";
        const widthPercent = (item.durationMs / maxDuration) * 100;
        const isRunning = item.status === "running";

        return (
          <div key={i}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                    animation: isRunning
                      ? "fp-timeline-pulse 1.6s ease-in-out infinite"
                      : undefined,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--fp-text-2)" }}>{item.step}</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--fp-font-mono)",
                  color: "var(--fp-text-3)",
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                {formatDuration(item.durationMs)}
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--fp-surface-2, rgba(255,255,255,0.06))",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${widthPercent}%`,
                  background: color,
                  borderRadius: 2,
                  transition: "width 0.3s ease",
                  animation: isRunning ? "fp-timeline-pulse 1.6s ease-in-out infinite" : undefined,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
