"use client";
import * as React from "react";

export interface LocalTimeProps {
  /** Instant to display — ISO string, `Date`, or null/undefined. */
  date: string | Date | null | undefined;
  /** BCP-47 locale for formatting. Default: a fixed `"en-CA"` (see below). */
  locale?: string;
  /** `Intl.DateTimeFormat` options for the rendered text. Default: date + HH:mm. */
  options?: Intl.DateTimeFormatOptions;
  /**
   * Timezone for the server / first-paint render. Pinned so the SSR HTML and
   * the client's first render are byte-identical (no hydration mismatch);
   * after mount the text re-renders in the VIEWER's own zone. Default `"UTC"`.
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

// Pinned default locale. `Intl.DateTimeFormat(undefined, …)` resolves to the
// runtime's default locale — Node's on the server, `navigator.language` on the
// client — so leaving it unset re-introduces a hydration mismatch whenever the
// two differ. `"en-CA"` is the sortable `YYYY-MM-DD` locale the framework's
// table/detail cells have always used.
const DEFAULT_LOCALE = "en-CA";

/**
 * Absolute timestamp rendered in the VIEWER's timezone.
 *
 * Server Components can't know the browser's timezone, so a server-formatted
 * date always reflects the server's zone (UTC in most deployments) — the
 * classic "the dashboard clock is hours off" bug. `LocalTime` formats on the
 * client instead: it renders a deterministic `fallbackTimeZone` value during
 * SSR and the client's first paint (so hydration matches exactly), then a
 * `useEffect` flips it to the viewer's local zone. The visible correction only
 * happens for viewers outside `fallbackTimeZone`.
 *
 * The formatting **locale** is pinned to a fixed `"en-CA"` by default, so the
 * SSR HTML and the client's first render are byte-identical regardless of the
 * server's vs. the browser's default locale — only the TIMEZONE is
 * viewer-dependent. Callers wanting localized formatting pass an explicit
 * `locale`. With neither `locale` nor `options` set, the output matches the
 * framework's prior sortable format (`2026-05-29 14:30`).
 *
 * For relative ("5 minutes ago") labels use {@link TimeAgo} instead — those are
 * timezone-agnostic and never mismatch the device.
 *
 * @example
 * <LocalTime date={run.startedAt} />
 * <LocalTime date={iso} locale="ru-RU" options={{ hour: "2-digit", minute: "2-digit", hour12: false }} />
 */
export function LocalTime({
  date,
  locale,
  options,
  fallbackTimeZone = "UTC",
  placeholder = "—",
  className,
}: LocalTimeProps): React.JSX.Element {
  const target = React.useMemo(() => {
    if (date == null) return null;
    const d = date instanceof Date ? date : new Date(date);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [date]);

  // `false` on the server and the client's first render → both format in
  // `fallbackTimeZone`, so the hydrated markup is identical. The post-mount
  // effect flips this to `true`, re-rendering in the viewer's local zone.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // The locale is pinned across server and client first render, so it can never
  // drive a hydration mismatch — only the timezone differs pre- vs. post-mount.
  const resolvedLocale = locale ?? DEFAULT_LOCALE;
  // True only when the caller relies entirely on defaults (the framework's
  // table/detail cells). In that path we strip the locale's group separator to
  // reproduce the prior sortable `2026-05-29 14:30` format; when the caller
  // passes an explicit `locale` or `options`, we honor the output verbatim.
  const usingDefaults = locale === undefined && options === undefined;

  const text = React.useMemo(() => {
    if (!target) return placeholder;
    const formatted = new Intl.DateTimeFormat(resolvedLocale, {
      ...(options ?? DEFAULT_OPTIONS),
      // Pre-mount: pin the zone for deterministic SSR. Post-mount: omit it so
      // the browser's local zone is used.
      ...(mounted ? {} : { timeZone: fallbackTimeZone }),
    }).format(target);
    // en-CA + DEFAULT_OPTIONS renders `2026-05-29, 14:30`; drop the comma to
    // match the framework's prior sortable format. Only in the all-defaults path.
    return usingDefaults ? formatted.replace(", ", " ") : formatted;
  }, [target, resolvedLocale, options, mounted, fallbackTimeZone, placeholder, usingDefaults]);

  if (!target) return <span {...(className ? { className } : {})}>{placeholder}</span>;
  return (
    <time dateTime={target.toISOString()} {...(className ? { className } : {})}>
      {text}
    </time>
  );
}
