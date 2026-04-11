import type React from "react";

interface StatGridProps {
  data: Array<{ label: string; value: string | number; status?: string }>;
}

const statusColors: Record<string, string> = {
  ok: "#22c55e",
  warn: "#eab308",
  error: "#ef4444",
};

export function StatGridSection({ data }: StatGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
        marginBottom: 12,
      }}
    >
      {data.map((item, i) => {
        const color = item.status ? statusColors[item.status] : undefined;
        return (
          <div
            key={i}
            style={{
              padding: "14px 16px",
              background: "var(--fp-surface-1)",
              border: "1px solid var(--fp-border-1)",
              borderRadius: 8,
              borderLeft: color ? `3px solid ${color}` : undefined,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--fp-text-3)",
                marginBottom: 6,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "var(--fp-font-mono)",
                color: color ?? "var(--fp-text-1)",
                lineHeight: 1.2,
              }}
            >
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
