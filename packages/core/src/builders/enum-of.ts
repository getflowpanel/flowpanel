import type { SelectOption } from "../types/resource";
import type { Tone } from "../types/widget";
import type { LinkTarget } from "../types/widget-context";

/** A label, a `[label, tone]` pair, or `{ label, tone }`. The tone defaults to `"default"`. */
export type EnumEntry =
  | string
  | readonly [label: string, tone?: Tone]
  | { label: string; tone?: Tone };

/** One enum's labels and tones, declared once and read by columns, filters, forms and headers. */
export interface EnumDef<K extends string = string> {
  /** Every value, in declaration order. */
  readonly values: readonly K[];
  readonly labels: Readonly<Record<K, string>>;
  readonly tones: Readonly<Record<K, Tone>>;
  /** A badge column format with these labels and tones. Plain data: safe anywhere. */
  readonly format: {
    kind: "badge";
    labels: Readonly<Record<K, string>>;
    tones: Readonly<Record<K, Tone>>;
  };
  /** `{ label, value }` in declaration order, for a filter, a form field or a dashboard filter. */
  readonly options: SelectOption[];
  /** The label; an unknown value prints as itself, a missing one as `"—"`. */
  label(value: unknown): string;
  /** The tone; `"default"` for an unknown value. */
  tone(value: unknown): Tone;
  /** A header badge, or `null` for a nullish value; `href` links it, e.g. to the filtered list. */
  badge(
    value: unknown,
    options?: { href?: LinkTarget },
  ): { label: string; tone: Tone; href?: LinkTarget } | null;
}

type Pair = readonly [label: string, tone?: Tone];

const isPair = (entry: Exclude<EnumEntry, string>): entry is Pair => Array.isArray(entry);

function entryOf(entry: EnumEntry): { label: string; tone: Tone } {
  if (typeof entry === "string") return { label: entry, tone: "default" };
  if (isPair(entry)) return { label: entry[0], tone: entry[1] ?? "default" };
  return { label: entry.label, tone: entry.tone ?? "default" };
}

/** Keys from a database enum: a missing or extra label fails to compile. */
export function enumOf<const K extends string>(
  values: readonly K[],
  entries: Record<K, EnumEntry>,
): EnumDef<K>;
/** Keys from the entries themselves, in the order they are written. */
export function enumOf<const K extends string>(entries: Record<K, EnumEntry>): EnumDef<K>;
export function enumOf(
  first: readonly string[] | Record<string, EnumEntry>,
  second?: Record<string, EnumEntry>,
): EnumDef {
  const list = Array.isArray(first) ? (first as readonly string[]) : null;
  const entries = (list ? second : first) as Record<string, EnumEntry>;
  const values = list ? [...list] : Object.keys(entries);
  const labels: Record<string, string> = {};
  const tones: Record<string, Tone> = {};
  for (const value of values) {
    const entry = entryOf(entries[value] ?? value);
    labels[value] = entry.label;
    tones[value] = entry.tone;
  }
  const keyOf = (value: unknown): string | null => {
    const key =
      typeof value === "number" || typeof value === "bigint" || typeof value === "boolean"
        ? String(value)
        : value;
    return typeof key === "string" && Object.hasOwn(labels, key) ? key : null;
  };
  const label = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    const key = keyOf(value);
    return key === null ? String(value) : (labels[key] ?? key);
  };
  const tone = (value: unknown): Tone => {
    const key = keyOf(value);
    return key === null ? "default" : (tones[key] ?? "default");
  };
  return {
    values,
    labels,
    tones,
    format: { kind: "badge", labels, tones },
    options: values.map((value) => ({ label: labels[value] as string, value })),
    label,
    tone,
    badge(value, options = {}) {
      if (value === null || value === undefined) return null;
      const pill = { label: label(value), tone: tone(value) };
      return options.href === undefined ? pill : { ...pill, href: options.href };
    },
  };
}
