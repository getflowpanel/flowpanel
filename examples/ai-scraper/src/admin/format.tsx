import type { ColumnFormat } from "@flowpanel/kit";
import { StatusBadge } from "@flowpanel/kit/react";
import type { CSSProperties } from "react";
import { modelLabel } from "@/src/lib/ai-models";

/** `format: money` on any integer-cents column — renders "$12.34". */
export const money: ColumnFormat = { kind: "money", minorUnits: 2 };

// Cell renderers for the app-specific shapes the framework doesn't cover --
const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const tabularNums: CSSProperties = { fontVariantNumeric: "tabular-nums" };

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
      className="text-fp-text-1 underline decoration-fp-border-2 underline-offset-2 hover:decoration-fp-text-3"
    >
      {url}
    </a>
  );
};

/** AI model slug as a clean-named badge instead of a raw, capitalize-mangled enum. */
export const modelBadge = (model: string | null | undefined) =>
  model == null ? "—" : <StatusBadge status={modelLabel(model)} />;

/** Milliseconds → "820 ms", "1.4 s", "28 min" or "1 h 5 min". */
export const formatDuration = (ms: number | null | undefined) => {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
};

/** Star rating like "★ 4.8" (warn-toned star + tabular number). */
export const ratingCell = (rating: number | null | undefined) => {
  if (rating == null) return "—";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <span style={{ color: "hsl(var(--fp-warn-text))" }}>★</span>
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
