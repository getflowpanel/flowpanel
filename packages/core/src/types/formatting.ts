/** How the admin renders numbers, money and timestamps. */
export interface FormattingConfig {
  /** BCP-47 locale for numbers, money and dates. Default: `"en-US"`. */
  locale?: string;
  /**
   * IANA zone every timestamp renders in — server, first paint and after hydration, `LocalTime` included.
   * Left unset, the server and first paint use UTC and `LocalTime` switches to the reader's zone after hydration.
   */
  timeZone?: string;
  /** ISO 4217 code for the `money` format when a column names none. Default: `"USD"`. */
  currency?: string;
}

export interface ResolvedFormatting extends Required<FormattingConfig> {
  /** Locale for timestamps; with none configured this stays `"en-CA"`, whose `YYYY-MM-DD HH:mm` sorts and scans in a table. */
  dateLocale: string;
  /**
   * `"config"` when the admin set `timeZone`, so `LocalTime` keeps it after
   * hydration; `"default"` when it fell back to UTC. Absent reads as `"default"`.
   */
  timeZoneSource?: "config" | "default";
}

export const DEFAULT_FORMATTING: ResolvedFormatting = {
  locale: "en-US",
  dateLocale: "en-CA",
  timeZone: "UTC",
  timeZoneSource: "default",
  currency: "USD",
};

export function resolveFormatting(config?: FormattingConfig): ResolvedFormatting {
  return {
    locale: config?.locale ?? DEFAULT_FORMATTING.locale,
    dateLocale: config?.locale ?? DEFAULT_FORMATTING.dateLocale,
    timeZone: config?.timeZone ?? DEFAULT_FORMATTING.timeZone,
    timeZoneSource: config?.timeZone === undefined ? "default" : "config",
    currency: config?.currency ?? DEFAULT_FORMATTING.currency,
  };
}
