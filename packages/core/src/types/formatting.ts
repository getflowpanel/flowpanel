/** How the admin renders numbers, money and timestamps. */
export interface FormattingConfig {
  /** BCP-47 locale for numbers, money and dates. Default: `"en-US"`. */
  locale?: string;
  /** IANA zone every timestamp renders in, on the server and after hydration, `LocalTime` included. Default: `"UTC"`. */
  timeZone?: string;
  /** ISO 4217 code for the `money` format when a column names none. Default: `"USD"`. */
  currency?: string;
}

export interface ResolvedFormatting extends Required<FormattingConfig> {
  /** Locale for timestamps; with none configured this stays `"en-CA"`, whose `YYYY-MM-DD HH:mm` sorts and scans in a table. */
  dateLocale: string;
}

export const DEFAULT_FORMATTING: ResolvedFormatting = {
  locale: "en-US",
  dateLocale: "en-CA",
  timeZone: "UTC",
  currency: "USD",
};

export function resolveFormatting(config?: FormattingConfig): ResolvedFormatting {
  return {
    locale: config?.locale ?? DEFAULT_FORMATTING.locale,
    dateLocale: config?.locale ?? DEFAULT_FORMATTING.dateLocale,
    timeZone: config?.timeZone ?? DEFAULT_FORMATTING.timeZone,
    currency: config?.currency ?? DEFAULT_FORMATTING.currency,
  };
}
