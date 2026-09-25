import type {
  SeriesRow,
  Threshold,
  Tone,
  TrackerCellResult,
  TrackerOptions,
  TrackerRowResult,
} from "@flowpanel/core";
import {
  keyLabel,
  series,
  shiftCalendarDays,
  toneFor,
  zonedTime,
  zoneParts,
} from "@flowpanel/core";

const HOUR_MS = 3_600_000;
const SEVERITY: Record<Tone, number> = {
  muted: 0,
  default: 1,
  accent: 1,
  info: 1,
  ok: 2,
  warn: 3,
  err: 4,
};

export interface TrackerWindow {
  from: Date;
  to: Date;
  timeZone: string;
  grain: "hour" | "day";
}

const warned = new Set<string>();

function warnWindow(window: string): void {
  if (process.env.NODE_ENV === "production" || warned.has(window)) return;
  warned.add(window);
  console.warn(
    `[flowpanel] tracker window "${window}" is not a whole number of hours or days ` +
      'such as "24h" or "14d"; the tracker shows the last 24 hours.',
  );
}

/** `window` as whole blocks ending with the current one: hours up to 48, days beyond. */
export function trackerWindow(
  window: string | undefined,
  now: number,
  timeZone: string,
): TrackerWindow {
  const match = /^(\d+)([hd])$/.exec(window ?? "");
  const amount = Number(match?.[1]);
  const valid = match !== null && amount > 0;
  if (!valid && window !== undefined) warnWindow(window);
  const hours = valid ? amount * (match[2] === "d" ? 24 : 1) : 24;
  const to = new Date(now);
  const clock = zoneParts(to, timeZone);
  if (hours <= 48) {
    const hourStart = zonedTime(clock, clock.hour * HOUR_MS, timeZone).getTime();
    return { from: new Date(hourStart - (hours - 1) * HOUR_MS), to, timeZone, grain: "hour" };
  }
  const days = Math.ceil(hours / 24);
  return {
    from: zonedTime(shiftCalendarDays(clock, 1 - days), 0, timeZone),
    to,
    timeZone,
    grain: "day",
  };
}

/** The worst tone of the last three blocks: the row's state right now. */
export function worstTone(cells: readonly { tone: Tone }[]): Tone {
  return cells
    .slice(-3)
    .reduce<Tone>(
      (worst, cell) => (SEVERITY[cell.tone] > SEVERITY[worst] ? cell.tone : worst),
      "muted",
    );
}

function bucketStart(key: string, timeZone: string): Date {
  const [day = "1970-01-01", clock = "00:00"] = key.split("T");
  const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);
  return zonedTime({ year, month, day: date }, Number(clock.slice(0, 2)) * HOUR_MS, timeZone);
}

function blockTone(value: number | null, volume: number, tones: Threshold | undefined): Tone {
  if (value === null || volume === 0) return "muted";
  return tones ? toneFor(value, tones, volume) : "accent";
}

const numberAt = (point: SeriesRow | undefined, key: string): number | null => {
  const value = point?.[key];
  return typeof value === "number" ? value : null;
};

/** One row per `by` value and one block per bucket of the window, toned by `tones`. */
export function trackerRows<R>(
  rows: readonly R[],
  options: TrackerOptions<R>,
  window: TrackerWindow,
): TrackerRowResult[] {
  if (!options.at) return [];
  const base = {
    at: options.at,
    grain: window.grain,
    ...(options.by ? { by: options.by } : {}),
    ...(options.keys ? { keys: options.keys } : {}),
  };
  const values: SeriesRow[] = series(rows, window, {
    ...base,
    ...(options.value ? { value: options.value } : {}),
  });
  const volumes: SeriesRow[] = series(rows, window, {
    ...base,
    ...(options.volume ? { value: options.volume } : {}),
  });
  const keys = Object.keys(values[0] ?? {}).filter((key) => key !== "date");
  return keys.map((key) => {
    const cells: TrackerCellResult[] = values.map((point, index) => {
      const value = numberAt(point, key);
      const volume = numberAt(volumes[index], key) ?? 0;
      return {
        start: bucketStart(point.date, window.timeZone),
        value,
        volume,
        tone: blockTone(value, volume, options.tones),
      };
    });
    const label = options.by ? keyLabel(options.labels, key) : (options.label ?? "");
    return { key, label, tone: worstTone(cells), cells };
  });
}
