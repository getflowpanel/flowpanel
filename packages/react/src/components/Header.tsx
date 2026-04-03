import React, { useRef, useEffect } from "react";
import type { LiveStatus } from "../hooks/useFlowPanelStream.js";

export type { LiveStatus };

const LIVE_STATUS_CONFIG: Record<LiveStatus, { color: string; label: string }> = {
  live:         { color: "#10b981", label: "Live" },
  reconnecting: { color: "#f59e0b", label: "Reconnecting..." },
  polling:      { color: "#6366f1", label: "Polling" },
  paused:       { color: "#5c5c6b", label: "Paused" },
};

interface HeaderProps {
  appName: string;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  timeRangePresets: string[];
  liveStatus: LiveStatus;
}

export function Header({ appName, timeRange, onTimeRangeChange, timeRangePresets, liveStatus }: HeaderProps) {
  const [showPresets, setShowPresets] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lsCfg = LIVE_STATUS_CONFIG[liveStatus];

  // Close dropdown on outside click
  useEffect(() => {
    if (!showPresets) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPresets]);

  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", height: 52,
      borderBottom: "1px solid var(--fp-border-1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-text-1)" }}>
          ⚡ {appName}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Time range picker */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowPresets((v) => !v)}
            style={{
              padding: "5px 12px", borderRadius: 6,
              background: "var(--fp-surface-2)",
              border: "1px solid var(--fp-border-1)",
              color: "var(--fp-text-1)", cursor: "pointer", fontSize: 13,
            }}
            aria-haspopup="listbox"
            aria-expanded={showPresets}
            aria-label={`Time range: ${timeRange}`}
          >
            {timeRange} ▾
          </button>
          {showPresets && (
            <div
              role="listbox"
              aria-label="Time range presets"
              style={{
                position: "absolute", right: 0, top: "calc(100% + 4px)",
                background: "var(--fp-surface-1)",
                border: "1px solid var(--fp-border-1)",
                borderRadius: 8, overflow: "hidden", zIndex: 30,
                minWidth: 80,
              }}
            >
              {timeRangePresets.map((preset) => (
                <div
                  key={preset}
                  role="option"
                  aria-selected={preset === timeRange}
                  onClick={() => { onTimeRangeChange(preset); setShowPresets(false); }}
                  style={{
                    padding: "8px 16px", cursor: "pointer", fontSize: 13,
                    color: preset === timeRange ? "var(--fp-accent-text)" : "var(--fp-text-1)",
                    background: preset === timeRange ? "var(--fp-accent-dim)" : undefined,
                    transition: `background var(--fp-duration) ease`,
                  }}
                >
                  {preset}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live indicator */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fp-text-2)" }}
          aria-live="polite"
          aria-label={`Connection: ${lsCfg.label}`}
        >
          <span
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: lsCfg.color, display: "inline-block",
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
