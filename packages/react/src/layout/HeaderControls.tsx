"use client";

import { Command as CommandIcon, Radio, WifiOff } from "lucide-react";
import type { LiveStatus } from "../hooks/useFlowPanelStream";
import { useLocale } from "../locale/LocaleContext";
import { modKey } from "../utils/platform";
import { cn } from "../utils/cn";
import { ThemeToggle } from "./ThemeToggle";

export interface HeaderControlsProps {
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  timeRangePresets?: string[];
  liveStatus?: LiveStatus;
  onOpenPalette?: () => void;
}

/**
 * Set of controls typically placed on the right side of the shell header.
 * Time range (optional), live status indicator, command palette trigger, theme toggle.
 */
export function HeaderControls({
  timeRange,
  onTimeRangeChange,
  timeRangePresets,
  liveStatus,
  onOpenPalette,
}: HeaderControlsProps) {
  const locale = useLocale();
  const mod = modKey();

  return (
    <div className="flex items-center gap-2">
      {timeRangePresets && onTimeRangeChange && (
        <div
          role="radiogroup"
          aria-label="Time range"
          className="hidden md:inline-flex overflow-hidden rounded-md border border-border text-xs"
        >
          {timeRangePresets.map((p) => {
            const active = p === timeRange;
            return (
              <button
                type="button"
                key={p}
                role="radio"
                aria-checked={active}
                onClick={() => onTimeRangeChange(p)}
                className={cn(
                  "px-2.5 py-1 font-mono transition-colors",
                  active
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}

      {liveStatus && (
        <div
          className={cn(
            "hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs",
            liveStatus === "live" && "text-foreground",
            liveStatus !== "live" && "text-muted-foreground",
          )}
          aria-live="polite"
          aria-label={`Connection: ${liveStatus}`}
        >
          {liveStatus === "live" ? (
            <Radio className="h-3 w-3 text-green-500 animate-pulse" aria-hidden="true" />
          ) : liveStatus === "reconnecting" ? (
            <Radio className="h-3 w-3 text-yellow-500 animate-pulse" aria-hidden="true" />
          ) : (
            <WifiOff className="h-3 w-3" aria-hidden="true" />
          )}
          <span>
            {liveStatus === "live"
              ? locale.liveStatus
              : liveStatus === "reconnecting"
                ? locale.reconnecting
                : locale.polling}
          </span>
        </div>
      )}

      {onOpenPalette && (
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Open command palette"
          className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <CommandIcon className="h-3 w-3" aria-hidden="true" />
          <kbd className="font-mono">{mod}K</kbd>
        </button>
      )}

      <ThemeToggle />
    </div>
  );
}
