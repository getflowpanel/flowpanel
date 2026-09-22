"use client";
import * as React from "react";
import { useFormatting } from "../_provider/FormattingContext";

export interface LocalTimeProps {
  /** Instant to display — ISO string, `Date`, or null/undefined. */
  date: string | Date | null | undefined;
  /** BCP-47 locale for formatting. Defaults to the admin's configured locale. */
  locale?: string;
  /** `Intl.DateTimeFormat` options for the rendered text. Default: date + HH:mm. */
  options?: Intl.DateTimeFormatOptions;
  /** Timezone for the server / first-paint render. Defaults to the configured one. */
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

/** Absolute timestamp rendered in the VIEWER's timezone. */
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
  const resolvedFallbackZone = fallbackTimeZone ?? formatting.timeZone;
  const usingDefaults = locale === undefined && options === undefined;

  const text = React.useMemo(() => {
    if (!target) return placeholder;
    const formatted = new Intl.DateTimeFormat(resolvedLocale, {
      ...(options ?? DEFAULT_OPTIONS),
      ...(mounted ? {} : { timeZone: resolvedFallbackZone }),
    }).format(target);
    return usingDefaults ? formatted.replace(", ", " ") : formatted;
  }, [target, resolvedLocale, options, mounted, resolvedFallbackZone, placeholder, usingDefaults]);

  if (!target) return <span {...(className ? { className } : {})}>{placeholder}</span>;
  return (
    <time dateTime={target.toISOString()} {...(className ? { className } : {})}>
      {text}
    </time>
  );
}
