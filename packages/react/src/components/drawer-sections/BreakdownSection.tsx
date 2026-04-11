interface BreakdownProps {
  data: Array<{ label: string; count: number; color?: string }>;
}

export function BreakdownSection({ data }: BreakdownProps) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);

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
        gap: 10,
      }}
    >
      {data.map((item, i) => {
        const barColor = item.color ?? "var(--fp-accent)";
        const widthPercent = (item.count / maxCount) * 100;

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
              <span style={{ fontSize: 12, color: "var(--fp-text-2)" }}>{item.label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--fp-font-mono)",
                  fontWeight: 600,
                  color: "var(--fp-text-1)",
                  background: "var(--fp-surface-2, rgba(255,255,255,0.06))",
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {item.count}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--fp-surface-2, rgba(255,255,255,0.06))",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${widthPercent}%`,
                  background: barColor,
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
