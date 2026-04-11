import { useState } from "react";

interface DemoBannerProps {
  runCount: number;
  realRunCount: number;
  onClear: () => void;
}

export function DemoBanner({ runCount, realRunCount, onClear }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const message =
    realRunCount > 0
      ? `You have ${realRunCount} real run${realRunCount > 1 ? "s" : ""}. Demo data is still visible.`
      : `Demo mode · ${runCount.toLocaleString()} seeded runs. Add withRun() to your workers to see real data.`;

  return (
    <div
      role="status"
      aria-label="Demo mode notice"
      className="fp:flex fp:items-center fp:justify-between fp:py-2.5 fp:px-6 fp:bg-accent/10 fp:border-b fp:border-border fp:text-[13px] fp:text-muted-foreground"
    >
      <span>ⓘ {message}</span>
      <div className="fp:flex fp:gap-2">
        <button
          onClick={onClear}
          className="fp:text-xs fp:py-[3px] fp:px-2.5 fp:rounded fp:bg-muted fp:border fp:border-border fp:cursor-pointer fp:text-foreground"
          aria-label="Clear demo data"
        >
          Clear demo data
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss demo notice"
          className="fp:text-xs fp:py-[3px] fp:px-2 fp:rounded fp:bg-transparent fp:border-none fp:cursor-pointer fp:text-muted-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
