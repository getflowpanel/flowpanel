import { toDateValue } from "../format-values";
import type { Tone } from "../types/widget";
import type { ChecklistItem } from "../types/widget-activity";
import type { LinkTarget } from "../types/widget-context";

const ISO = /^\d{4}-\d{2}-\d{2}/;
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Present: anything but `null`, `undefined`, `false`, a blank string or an empty list. */
export function isDone(done: unknown): boolean {
  if (done === null || done === undefined || done === false) return false;
  if (typeof done === "string") return done.trim() !== "";
  if (Array.isArray(done)) return done.length > 0;
  return true;
}

/** One item of a checklist as its card shows it. */
export interface ChecklistRow {
  label: string;
  state: "done" | "todo" | "optional";
  hint?: string;
  tone?: Tone;
  href?: LinkTarget;
  /** When it was done, with a clock; `null` without one or when the list is not ordered. */
  at: Date | null;
  /** When it was done, as a `YYYY-MM-DD` day without a clock. */
  day: string | null;
  /** Milliseconds since the previous done step; `null` when either has no clock or time runs back. */
  gapMs: number | null;
}

function whenOf(item: ChecklistItem): { at: Date | null; day: string | null } {
  const text = typeof item.done === "string" && ISO.test(item.done) ? item.done : null;
  const at = item.done instanceof Date || text !== null ? toDateValue(item.done) : null;
  if (at === null) return { at: null, day: null };
  if (item.precision === "day" || (text !== null && DAY_ONLY.test(text))) {
    return { at: null, day: text !== null ? text.slice(0, 10) : at.toISOString().slice(0, 10) };
  }
  return { at, day: null };
}

/**
 * The checklist's rows in order, and how many required items are done. Ordered, a done item
 * carries when it was done and the gap since the previous done item.
 */
export function checklistRows(
  items: readonly ChecklistItem[],
  ordered: boolean,
): { rows: ChecklistRow[]; done: number; total: number } {
  let done = 0;
  let total = 0;
  let previous: Date | null = null;
  const rows = items.map((item): ChecklistRow => {
    const finished = isDone(item.done);
    if (!item.optional) {
      total += 1;
      if (finished) done += 1;
    }
    const when = ordered && finished ? whenOf(item) : { at: null, day: null };
    let gapMs: number | null = null;
    if (ordered && finished) {
      if (previous !== null && when.at !== null && when.at.getTime() >= previous.getTime()) {
        gapMs = when.at.getTime() - previous.getTime();
      }
      previous = when.at;
    }
    return {
      label: item.label,
      state: finished ? "done" : item.optional ? "optional" : "todo",
      ...(item.hint !== undefined ? { hint: item.hint } : {}),
      ...(item.tone !== undefined ? { tone: item.tone } : {}),
      ...(item.href !== undefined ? { href: item.href } : {}),
      at: when.at,
      day: when.day,
      gapMs,
    };
  });
  return { rows, done, total };
}
