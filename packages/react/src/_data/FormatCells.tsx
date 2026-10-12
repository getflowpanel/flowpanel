"use client";
import {
  DEFAULT_FORMATTING,
  formatDateValue,
  formatRelativeValue,
  type ResolvedFormatting,
  toDateValue,
} from "@flowpanel/core/format";
import { useLabels } from "../_provider/LabelsContext";
import { ToneWord } from "../_widgets/ToneWord";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneTextClass } from "../lib/tone-classes";

const HEAT_CLASS = [
  "",
  "fp-bg-data/10",
  "fp-bg-data/20",
  "fp-bg-data/30",
  "fp-bg-data/40",
  "fp-bg-data/50",
] as const;

export interface HeatCellProps {
  /** Shade step from 0 to 5, as `percentHeatLevel` returns it. */
  level: number;
  text: string;
}

/** A percent cell shaded by its value — a retention grid read at a glance. */
export function HeatCell({ level, text }: HeatCellProps) {
  return (
    <span
      data-heat={level}
      className={cn(
        "fp-inline-block fp-rounded-sm fp-px-1.5 fp-py-0.5 fp-tabular-nums",
        HEAT_CLASS[level] ?? "",
      )}
    >
      {text}
    </span>
  );
}

export interface UrlCellProps {
  href: string;
  text: string;
}

/** A link cell. An absolute URL opens in a new tab; neither a click nor Enter opens the row. */
export function UrlCell({ href, text }: UrlCellProps) {
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      title={href}
      className="fp-block fp-max-w-72 fp-truncate fp-text-accent hover:fp-underline"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {text}
    </a>
  );
}

export interface BooleanCellProps {
  value: boolean;
}

/** `✓` or `✕`, and yes or no in the admin's language for a screen reader. */
export function BooleanCell({ value }: BooleanCellProps) {
  const { filters } = useLabels();
  return (
    <span>
      <span aria-hidden>{value ? "✓" : "✕"}</span>
      <span className="fp-sr-only">{value ? filters.yes : filters.no}</span>
    </span>
  );
}

export interface RelativeTimeCellProps {
  value: Date | string | number;
  formatting?: ResolvedFormatting;
}

/** `5 minutes ago`, with the exact timestamp in the tooltip. */
export function RelativeTimeCell({
  value,
  formatting = DEFAULT_FORMATTING,
}: RelativeTimeCellProps) {
  const date = toDateValue(value);
  if (date === null) return <>{String(value)}</>;
  return (
    <time
      suppressHydrationWarning
      dateTime={date.toISOString()}
      title={formatDateValue(date, formatting)}
    >
      {formatRelativeValue(date, formatting)}
    </time>
  );
}

export interface ToneTextProps {
  tone: Tone;
  text: string;
}

/** A numeric cell coloured by its threshold's tone. */
export function ToneText({ tone, text }: ToneTextProps) {
  return (
    <span data-tone={tone} className={`fp-tabular-nums ${toneTextClass[tone]}`}>
      <ToneWord tone={tone} />
      {text}
    </span>
  );
}
