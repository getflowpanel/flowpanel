const DATE_KEYS = new Set(["era", "year", "month", "day", "weekday", "dateStyle"]);
const CLOCK_KEYS = new Set([
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "dayPeriod",
  "timeStyle",
]);
const SHARED_KEYS = new Set(["timeZone", "calendar", "numberingSystem"]);
const FORMATS = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = FORMATS.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    FORMATS.set(key, format);
  }
  return format;
}

function pick(
  options: Intl.DateTimeFormatOptions,
  keep: (key: string) => boolean,
): Intl.DateTimeFormatOptions {
  return Object.fromEntries(Object.entries(options).filter(([key]) => keep(key)));
}

/** Date and time formatted apart and joined here, since engines put different words between them. */
export function formatDateTime(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
  joiner = ", ",
): string {
  const day = pick(options, (key) => DATE_KEYS.has(key) || SHARED_KEYS.has(key));
  const clock = pick(options, (key) => !DATE_KEYS.has(key));
  const hasDay = Object.keys(day).some((key) => DATE_KEYS.has(key));
  const hasClock = Object.keys(clock).some((key) => CLOCK_KEYS.has(key));
  if (!hasDay || !hasClock) return formatter(locale, options).format(date);
  return `${formatter(locale, day).format(date)}${joiner}${formatter(locale, clock).format(date)}`;
}
