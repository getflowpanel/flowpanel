import React, { useState } from "react";

interface DemoBannerProps {
  runCount: number;
  realRunCount: number;
  onClear: () => void;
}

export function DemoBanner({ runCount, realRunCount, onClear }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const message = realRunCount > 0
    ? `You have ${realRunCount} real run${realRunCount > 1 ? "s" : ""}. Demo data is still visible.`
    : `Demo mode · ${runCount.toLocaleString()} seeded runs. Add withRun() to your workers to see real data.`;

  return (
    <div
      role="status"
      aria-label="Demo mode notice"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 24px",
        background: "var(--fp-accent-dim)",
        borderBottom: "1px solid var(--fp-border-1)",
        fontSize: 13, color: "var(--fp-text-2)",
      }}
    >
      <span>ⓘ {message}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onClear}
          style={{
            fontSize: 12, padding: "3px 10px", borderRadius: 4,
            background: "var(--fp-surface-2)",
            border: "1px solid var(--fp-border-1)",
            cursor: "pointer", color: "var(--fp-text-1)",
          }}
          aria-label="Clear demo data"
        >
          Clear demo data
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss demo notice"
          style={{
            fontSize: 12, padding: "3px 8px", borderRadius: 4,
            background: "transparent", border: "none",
            cursor: "pointer", color: "var(--fp-text-3)",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
