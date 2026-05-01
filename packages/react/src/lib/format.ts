/**
 * Numeric format helpers mirrored from @flowpanel/core widget types.
 * Kept in sync with `NumericFormat` / `Tone` in core/src/types/widget.ts.
 */

export type NumericFormat = "number" | "currency" | "percent" | "bytes" | "duration";
export type Tone = "default" | "accent" | "success" | "warning" | "danger" | "muted";

export function formatNumber(
  v: number,
  format: NumericFormat = "number",
  locale = "en-US",
): string {
  if (!Number.isFinite(v)) return String(v);
  switch (format) {
    case "currency":
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
    case "percent":
      return new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(v);
    case "bytes": {
      const units = ["B", "KB", "MB", "GB", "TB"];
      let i = 0;
      let n = v;
      while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
      }
      return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
    }
    case "duration": {
      const s = Math.round(v / 1000);
      if (s < 60) return `${s}s`;
      if (s < 3600) return `${Math.round(s / 60)}m`;
      return `${(s / 3600).toFixed(1)}h`;
    }
    default:
      return new Intl.NumberFormat(locale).format(v);
  }
}
