import { dayKeyIn, shiftDayKey, weekdayOf } from "./day-key";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The first day of a week in `locale`: 1 = Monday … 7 = Sunday; Monday when the runtime cannot tell. */
export function weekStartOf(locale: string): number {
  try {
    const found = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    return (found.getWeekInfo?.() ?? found.weekInfo)?.firstDay ?? 1;
  } catch {
    return 1;
  }
}

/** Four steps by the quartiles of the non-zero values; zero is step 0 and the maximum step 4. */
export function heatLevels(values: readonly number[]): (value: number) => number {
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  const max = positive.at(-1);
  if (max === undefined) return () => 0;
  const at = (share: number) =>
    positive[Math.max(0, Math.ceil(share * positive.length) - 1)] as number;
  const [q1, q2, q3] = [at(0.25), at(0.5), at(0.75)];
  return (value) => {
    if (value <= 0) return 0;
    if (value >= max) return 4;
    return value <= q1 ? 1 : value <= q2 ? 2 : value <= q3 ? 3 : 4;
  };
}

/** One day of a heatmap and its step. */
export interface HeatCell {
  day: string;
  value: number;
  level: number;
}

/**
 * Totals per day of `timeZone` over the `days` days ending `today`, as weeks of seven cells
 * that start on `weekStart`; the days before the first and after the last are `null`.
 */
export function heatmapGrid(
  points: Iterable<{ at: Date | string; value: number }>,
  today: string,
  days: number,
  timeZone: string,
  weekStart: number,
): { weeks: Array<Array<HeatCell | null>>; total: number } {
  const first = shiftDayKey(today, -(days - 1));
  const totals = new Map<string, number>();
  for (const point of points) {
    const day =
      typeof point.at === "string" && DAY.test(point.at)
        ? point.at
        : dayKeyIn(new Date(point.at), timeZone);
    if (day < first || day > today) continue;
    const value = Number(point.value);
    totals.set(day, (totals.get(day) ?? 0) + (Number.isFinite(value) ? value : 0));
  }
  const level = heatLevels([...totals.values()]);
  const cells: Array<HeatCell | null> = Array.from(
    { length: (weekdayOf(first) - weekStart + 7) % 7 },
    () => null,
  );
  for (let i = 0; i < days; i += 1) {
    const day = shiftDayKey(first, i);
    const value = totals.get(day) ?? 0;
    cells.push({ day, value, level: level(value) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<HeatCell | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  let total = 0;
  for (const value of totals.values()) total += value;
  return { weeks, total };
}
