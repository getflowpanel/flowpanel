import type { DateRangePreset, ResolvedDateRange } from "@flowpanel/core";

export interface DateRangeInput {
  preset?: DateRangePreset;
  from?: Date | string;
  to?: Date | string;
}

const MS_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setUTCHours(0, 0, 0, 0);
  return n;
}

function startOfMonth(d: Date): Date {
  const n = new Date(d);
  n.setUTCDate(1);
  n.setUTCHours(0, 0, 0, 0);
  return n;
}

function startOfQuarter(d: Date): Date {
  const n = startOfMonth(d);
  const m = n.getUTCMonth();
  n.setUTCMonth(m - (m % 3));
  return n;
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

export function resolveDateRange(input: DateRangeInput): ResolvedDateRange {
  const now = new Date();
  if (input.from && input.to) {
    return { from: new Date(input.from), to: new Date(input.to), preset: "custom" };
  }
  const preset = input.preset ?? "last7d";
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: now, preset };
    case "yesterday": {
      const y = startOfDay(new Date(now.getTime() - MS_DAY));
      return { from: y, to: new Date(y.getTime() + MS_DAY - 1), preset };
    }
    case "last7d":
      return { from: new Date(now.getTime() - 7 * MS_DAY), to: now, preset };
    case "last30d":
      return { from: new Date(now.getTime() - 30 * MS_DAY), to: now, preset };
    case "MTD":
      return { from: startOfMonth(now), to: now, preset };
    case "QTD":
      return { from: startOfQuarter(now), to: now, preset };
    case "YTD":
      return { from: startOfYear(now), to: now, preset };
  }
}
