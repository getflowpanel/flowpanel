"use client";
import * as React from "react";

export interface TimeAgoProps {
  date: string | Date;
  locale?: string;
  /** Tick interval for live-updating labels. Default: 60_000 ms. */
  tickMs?: number;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1_000],
];

export function TimeAgo({ date, locale, tickMs = 60_000 }: TimeAgoProps) {
  const target = React.useMemo(() => (typeof date === "string" ? new Date(date) : date), [date]);
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const rtf = React.useMemo(
    () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
    [locale],
  );
  const diff = target.getTime() - Date.now();
  const abs = Math.abs(diff);

  for (const [unit, ms] of UNITS) {
    if (abs >= ms || unit === "second") {
      return (
        <time dateTime={target.toISOString()} title={target.toLocaleString()}>
          {rtf.format(Math.round(diff / ms), unit)}
        </time>
      );
    }
  }
  return null;
}
