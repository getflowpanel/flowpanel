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
  info: "border-fp-border-1 bg-fp-bg-2 text-fp-text-1",
  warn: "border-fp-warn/30 bg-fp-warn/10 text-fp-warn-text",
  err: "border-fp-err/30 bg-fp-err/10 text-fp-err-text",
};

export function HealthBanner({ tone, title, description, action }: HealthBannerProps) {
  return (
    <div
      role={tone === "err" ? "alert" : "status"}
      {...(tone === "err" ? { "data-fp-error": "" } : {})}
      className={`flex items-start gap-3 rounded-fp border px-4 py-3 text-sm ${TONE_CLASS[tone]}`}
    >
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        {description ? <div className="mt-1 opacity-80">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}
