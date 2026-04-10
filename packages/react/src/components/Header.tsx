import { useEffect, useRef } from "react";
import type { LiveStatus } from "../hooks/useFlowPanelStream.js";

export type { LiveStatus };

const LIVE_STATUS_CONFIG: Record<LiveStatus, { color: string; label: string }> = {
  live: { color: "#10b981", label: "Live" },
  reconnecting: { color: "#f59e0b", label: "Reconnecting..." },
  polling: { color: "#6366f1", label: "Polling" },
  paused: { color: "#5c5c6b", label: "Paused" },
};

interface HeaderProps {
  appName: string;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  timeRangePresets: string[];
  liveStatus: LiveStatus;
  onCommandPaletteOpen?: () => void;
}

export function Header({
  appName,
  timeRange,
  onTimeRangeChange,
  timeRangePresets,
  liveStatus,
  onCommandPaletteOpen,
}: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const lsCfg = LIVE_STATUS_CONFIG[liveStatus];

  // Responsive: check width
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const mq = window.matchMedia("(max-width: 768px)");
    function apply() {
      if (el) {
        el.style.flexWrap = mq.matches ? "wrap" : "nowrap";
        el.style.height = mq.matches ? "auto" : "52px";
        el.style.gap = mq.matches ? "8px" : "0";
        el.style.padding = mq.matches ? "12px 24px" : "0 24px";
      }
    }
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <header
      ref={headerRef}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 52,
        borderBottom: "1px solid var(--fp-border-1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-text-1)" }}>{appName}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Segmented time range buttons */}
        <div
          role="group"
          aria-label="Time range"
          style={{
            display: "flex",
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid var(--fp-border-1)",
          }}
        >
          {timeRangePresets.map((preset) => {
            const active = preset === timeRange;
            return (
              <button
                key={preset}
                onClick={() => onTimeRangeChange(preset)}
                aria-pressed={active}
                style={{
                  padding: "5px 10px",
                  background: active ? "var(--fp-accent-dim)" : "transparent",
                  color: active ? "var(--fp-accent-text)" : "var(--fp-text-2)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  transition: "background var(--fp-duration) ease, color var(--fp-duration) ease",
                }}
              >
                {preset}
              </button>
            );
          })}
        </div>

        {/* Command palette button */}
        {onCommandPaletteOpen && (
          <button
            onClick={onCommandPaletteOpen}
            aria-label="Open command palette"
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              background: "var(--fp-surface-2)",
              border: "1px solid var(--fp-border-1)",
              color: "var(--fp-text-3)",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "var(--fp-font-mono)",
            }}
          >
            <kbd style={{ fontFamily: "inherit" }}>⌘K</kbd>
          </button>
        )}

        {/* Live indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            color: "var(--fp-text-2)",
          }}
          aria-live="polite"
          aria-label={`Connection: ${lsCfg.label}`}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: lsCfg.color,
              display: "inline-block",
              boxShadow: liveStatus === "live" ? `0 0 0 2px ${lsCfg.color}33` : undefined,
            }}
            aria-hidden
          />
          {lsCfg.label}
        </div>
      </div>
    </header>
  );
}
