import type { ColumnFormat, Tone } from "@flowpanel/kit";
import { StatusBadge } from "@flowpanel/kit/react";
import type { CSSProperties } from "react";
import { modelLabel } from "@/src/lib/ai-models";

// Shared column formats for domain values Flowpanel cannot infer.
// The framework's `format: "badge"` auto-tones generic statuses (active →
// ok, failed → err). This map covers only the domain values it can't know.
const STATUS_TONES: Record<string, Tone> = {
  trialing: "warn", // users.status
  past_due: "err",
  starter: "info", // users.plan
  pro: "ok",
  business: "ok",
  paused: "warn", // scrapers.status
  queued: "muted", // runs.status — nothing is happening yet
  running: "info", // …and this one is, so it must not look the same
  open: "warn", // invoices.status
  paid: "ok",
  void: "err",
  refunded: "muted",
  in_stock: "ok", // listings.stock
  low_stock: "warn",
  out_of_stock: "err",
  confirmed: "ok", // matches.status
  needs_review: "warn",
};

/** `format: badge` on any status column — a themed pill, toned per value. */
export const badge: ColumnFormat = { kind: "badge", tones: STATUS_TONES };
/** `format: money` on any integer-cents column — renders "$12.34". */
export const money: ColumnFormat = { kind: "money", scale: 100 };

// Cell renderers for the app-specific shapes the framework doesn't cover --
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const shortDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const tabularNums: CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** Human-readable timestamp, or an em dash for null. */
export const formatDate = (value: Date | string | null | undefined) =>
  value == null ? "—" : dateTime.format(new Date(value));

/** One-line timestamp for narrow columns, e.g. "Aug 18, 4:32 PM". */
export const formatShortDate = (value: Date | string | null | undefined) =>
  value == null ? "—" : shortDateTime.format(new Date(value));

/** Billing period as a month, e.g. "Aug 2026". */
export const formatMonth = (value: Date | string | null | undefined) =>
  value == null ? "—" : monthYear.format(new Date(value));

/** External target URL as a real, new-tab link. */
export const urlCell = (url: string | null | undefined) => {
  if (!url) return "—";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="truncate text-fp-text-1 underline decoration-fp-border-2 underline-offset-2 hover:decoration-fp-text-3"
    >
      {url}
    </a>
  );
};

/** AI model slug as a clean-named badge instead of a raw, capitalize-mangled enum. */
export const modelBadge = (model: string | null | undefined) =>
  model == null ? "—" : <StatusBadge status={modelLabel(model)} />;

/** Milliseconds → "820 ms" / "1.4 s". */
export const formatDuration = (ms: number | null | undefined) => {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
};

/** Star rating like "★ 4.8" (warn-toned star + tabular number). */
export const ratingCell = (rating: number | null | undefined) => {
  if (rating == null) return "—";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <span style={{ color: "hsl(var(--fp-warn))" }}>★</span>
      <span style={tabularNums}>{rating.toFixed(1)}</span>
    </span>
  );
};

/** AI match confidence 0–1 → "72%", toned by band off the same `--fp-*` tokens as badges. */
export const confidenceCell = (c: number | null | undefined) => {
  if (c == null) return "—";
  const pct = Math.round(c * 100);
  const tone = pct >= 85 ? "--fp-ok" : pct >= 55 ? "--fp-warn" : "--fp-err";
  const color = `color-mix(in srgb, hsl(var(${tone})) 70%, hsl(var(--fp-text-1)))`;
  return <span style={{ ...tabularNums, fontWeight: 500, color }}>{pct}%</span>;
};
