import { type TrackerWidget, tracker } from "@flowpanel/core";
import { expectError, expectType } from "tsd";

type Hour = { at: Date; platform: string; runs: number; failed: number };
const hourly = async (): Promise<Hour[]> => [];

expectType<TrackerWidget>(
  tracker({
    query: hourly,
    at: "at",
    by: "platform",
    value: (rows) => rows.length,
    volume: "runs",
    tones: { warn: 0.3, err: 0.5, min: 20 },
    window: "24h",
    summary: async (row) => row.label,
    freshness: { at: async () => null, warnAfter: "2h" },
  }),
);
tracker({ rows: async () => [{ key: "a", label: "A", cells: [{ tone: "ok" }] }], window: "14d" });
expectError(tracker({ query: hourly, at: "when" }));
expectError(tracker({ query: hourly, at: "at", window: "24 hours" }));
expectError(tracker({ query: hourly, at: "at", tooltip: () => "" }));
expectError(tracker({ query: hourly, at: "at", grain: "hour" }));
