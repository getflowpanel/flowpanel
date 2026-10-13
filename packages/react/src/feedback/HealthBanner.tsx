import type { ReactNode } from "react";

import type { Tone } from "../lib/format";

export interface HealthBannerProps {
  /** The shared `Tone` vocabulary; `"err"` is the one that reads as a failure. */
  tone: Extract<Tone, "info" | "warn" | "err">;
  title: string;
  description?: string;
  action?: ReactNode;
}

const TONE_CLASS: Record<HealthBannerProps["tone"], string> = {
  info: "fp-border-line fp-bg-canvas fp-text-ink",
  warn: "fp-border-warn/30 fp-bg-warn/10 fp-text-warn-ink",
  err: "fp-border-err/30 fp-bg-err/10 fp-text-err-ink",
};

export function HealthBanner({ tone, title, description, action }: HealthBannerProps) {
  return (
    <div
      role={tone === "err" ? "alert" : "status"}
      {...(tone === "err" ? { "data-fp-error": "" } : {})}
      className={`fp-flex fp-items-start fp-gap-3 fp-rounded fp-border fp-px-4 fp-py-3 fp-text-sm ${TONE_CLASS[tone]}`}
    >
      <div className="fp-flex-1">
        <div className="fp-font-medium">{title}</div>
        {description ? <div className="fp-mt-1 fp-opacity-80">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}
