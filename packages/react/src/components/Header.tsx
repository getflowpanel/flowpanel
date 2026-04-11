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
      className="fp:flex fp:items-center fp:justify-between fp:px-6 fp:h-[52px] fp:border-b fp:border-border"
    >
      <div className="fp:flex fp:items-center fp:gap-2">
        <span className="fp:text-[13px] fp:font-semibold fp:text-foreground">{appName}</span>
      </div>

      <div className="fp:flex fp:items-center fp:gap-3">
        {/* Segmented time range buttons */}
        <div
          role="group"
          aria-label="Time range"
          className="fp:flex fp:rounded-md fp:overflow-hidden fp:border fp:border-border"
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
                  color: active ? "var(--fp-accent-text)" : undefined,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  transition: "background var(--fp-duration) ease, color var(--fp-duration) ease",
                }}
                className={active ? "" : "fp:text-muted-foreground"}
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
            className="fp:py-1 fp:px-2 fp:rounded fp:bg-muted fp:border fp:border-border fp:text-muted-foreground fp:cursor-pointer fp:text-[11px] fp:font-mono"
          >
            <kbd className="fp:font-[inherit]">⌘K</kbd>
          </button>
        )}

        {/* Live indicator */}
        <div
          className="fp:flex fp:items-center fp:gap-[5px] fp:text-xs fp:text-muted-foreground"
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
