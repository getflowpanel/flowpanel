import type { EnumDef, EnumEntry, TimelineEvent } from "@flowpanel/core";
import { enumOf } from "../builders/enum-of";
import { dayKeyIn } from "./day-key";
import { isEnumDef } from "./key-labels";

/** Where the next page starts: at or before `before`, past the `skip` events shown at it. */
export interface TimelineCursor {
  before: Date;
  skip: number;
}

/** A timeline's `kinds` as one `EnumDef`, whichever form the config used. */
export function timelineKindsOf(kinds: EnumDef | Record<string, EnumEntry>): EnumDef {
  return isEnumDef(kinds) ? kinds : enumOf(kinds);
}

/** `<iso>~<n>` from the URL; `null` for the newest page or an unreadable value. */
export function readTimelineCursor(raw: string | null): TimelineCursor | null {
  if (!raw) return null;
  const at = raw.lastIndexOf("~");
  const before = new Date(at < 0 ? raw : raw.slice(0, at));
  const skip = at < 0 ? 0 : Number(raw.slice(at + 1));
  if (Number.isNaN(before.getTime()) || !Number.isInteger(skip) || skip < 0) return null;
  return { before, skip };
}

export function writeTimelineCursor(cursor: TimelineCursor): string {
  return `${cursor.before.toISOString()}~${cursor.skip}`;
}

/** The known kinds of `?<id>.kind=a,b`; `null` for every kind. */
export function pickedKinds(raw: string | null, known: readonly string[]): string[] | null {
  if (!raw) return null;
  const picked = raw.split(",").filter((kind) => known.includes(kind));
  return picked.length === 0 ? null : picked;
}

/**
 * The page after `cursor`, newest first across every list, stable-sorted by `at` (list order breaks ties).
 * `next` carries the last event's moment and how many events at that moment have been shown; `null` on the last page.
 */
export function mergeTimeline(
  lists: readonly (readonly TimelineEvent[])[],
  cursor: TimelineCursor | null,
  pageSize: number,
  kinds: readonly string[] | null,
): { events: TimelineEvent[]; next: TimelineCursor | null } {
  const before = cursor ? cursor.before.getTime() : Number.POSITIVE_INFINITY;
  const merged = lists
    .flat()
    .filter((e) => e.at.getTime() <= before && (kinds === null || kinds.includes(e.kind)))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  let skip = cursor?.skip ?? 0;
  const rest = merged.filter((e) => {
    if (skip === 0 || e.at.getTime() !== before) return true;
    skip -= 1;
    return false;
  });
  const events = rest.slice(0, pageSize);
  const last = events.at(-1);
  if (!last || rest.length <= pageSize) return { events, next: null };
  const moment = last.at.getTime();
  const shown = events.filter((e) => e.at.getTime() === moment).length;
  const carried = moment === before ? (cursor?.skip ?? 0) : 0;
  return { events, next: { before: last.at, skip: shown + carried } };
}

/** The events of one day; each line is one event, or a run of folded ones. */
export interface TimelineDay {
  day: string | null;
  count: number;
  lines: TimelineEvent[][];
}

/**
 * Events under days of `timeZone`, newest first; consecutive events sharing a day, kind and fold key share a line.
 * `false` gives one group with `day: null`.
 */
export function groupTimeline(
  events: readonly TimelineEvent[],
  timeZone: string,
  group: "day" | false,
): TimelineDay[] {
  const out: TimelineDay[] = [];
  let lastDayKey: string | null = null;
  for (const event of events) {
    const dayKey = dayKeyIn(event.at, timeZone);
    const day = group === false ? null : dayKey;
    let current = out.at(-1);
    if (!current || current.day !== day) {
      current = { day, count: 0, lines: [] };
      out.push(current);
    }
    current.count += 1;
    const line = current.lines.at(-1);
    const lead = line?.[0];
    const folds =
      lead !== undefined &&
      dayKey === lastDayKey &&
      lead.kind === event.kind &&
      (lead.fold ?? lead.title) === (event.fold ?? event.title);
    if (line && folds) line.push(event);
    else current.lines.push([event]);
    lastDayKey = dayKey;
  }
  return out;
}
