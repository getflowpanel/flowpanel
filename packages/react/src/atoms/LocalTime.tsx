"use client";
import { formatDateTime } from "@flowpanel/core/format";
import * as React from "react";
import { absoluteTime } from "../lib/absolute-time";
import { useFormatting } from "../provider/FormattingContext";

export interface LocalTimeProps {
  /** Instant to display — ISO string, `Date`, or null/undefined. */
  date: string | Date | null | undefined;
  /** BCP-47 locale for formatting. Defaults to the admin's configured locale. */
  locale?: string;
  /** `Intl.DateTimeFormat` options for the rendered text. Default: date + HH:mm. */
  options?: Intl.DateTimeFormatOptions;
  /**
   * Zone for the server and first-paint render; after hydration the reader's zone takes over.
   * Without it, `formatting.timeZone` is used throughout.
   */
  fallbackTimeZone?: string;
  /** Rendered when `date` is null/invalid. Default `"—"`. */
  placeholder?: string;
  className?: string;
}

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/** Absolute timestamp in `formatting.timeZone`, UTC until the admin sets one. */
export function LocalTime({
  date,
  locale,
  options,
  fallbackTimeZone,
  placeholder = "—",
  className,
}: LocalTimeProps): React.JSX.Element {
  const formatting = useFormatting();
  const target = React.useMemo(() => {
    if (date == null) return null;
    const d = date instanceof Date ? date : new Date(date);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [date]);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const resolvedLocale = locale ?? formatting.dateLocale;
  const zone =
    mounted && fallbackTimeZone !== undefined
      ? undefined
      : (fallbackTimeZone ?? formatting.timeZone);
  const usingDefaults = locale === undefined && options === undefined;

  const text = React.useMemo(() => {
    if (!target) return placeholder;
    return formatDateTime(
      target,
      resolvedLocale,
      { timeZone: zone, ...(options ?? DEFAULT_OPTIONS) },
      usingDefaults ? " " : ", ",
    );
  }, [target, resolvedLocale, options, zone, placeholder, usingDefaults]);

  if (!target) return <span {...(className ? { className } : {})}>{placeholder}</span>;
  return (
    <time
      dateTime={target.toISOString()}
      title={absoluteTime(target, formatting.locale, zone)}
      {...(className ? { className } : {})}
    >
      {text}
    </time>
  );
}
