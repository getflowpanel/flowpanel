import type { ReactNode } from "react";

export interface HealthBannerProps {
  tone: "info" | "warn" | "error";
  title: string;
  description?: string;
  action?: ReactNode;
}

const TONE_CLASS: Record<HealthBannerProps["tone"], string> = {
  info: "border-fp-border-1 bg-fp-bg-2 text-fp-text-1",
  warn: "border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100",
  error:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100",
};

export function HealthBanner({ tone, title, description, action }: HealthBannerProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
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
