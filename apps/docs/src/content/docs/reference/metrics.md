---
title: 'Metric helpers'
description: 'FlowPanel exposes three helpers for building metric loaders with minimal'
---


FlowPanel exposes three helpers for building metric loaders with minimal
boilerplate. All three are ORM-agnostic — you provide a `compute` callback
that runs against your database of choice (Drizzle, Prisma, or raw SQL).

## `metric()`

Scalar value + optional `vs-previous-period` trend. When `trend` is set, the
helper runs `compute` twice — once with the current range, once with the
shifted previous range — and computes delta / deltaPercent / direction for
you.

```ts
import { metric } from "@flowpanel/core";
import { and, between, eq, sum } from "drizzle-orm";

const mrr = metric({
  defaultRange: "30d",
  trend: "vs-previous-period",
  compute: async ({ db }, { start, end }) => {
    const [r] = await db
      .select({ v: sum(payments.amountRub) })
      .from(payments)
      .where(and(eq(payments.status, "succeeded"), between(payments.paidAt, start, end)));
    return Number(r?.v ?? 0);
  },
});

// Use in a dashboard:
w.metric({ label: "MRR", format: "money", ...mrr });
```

### Options

| Option         | Type                                      | Default | Description                             |
| -------------- | ----------------------------------------- | ------- | --------------------------------------- |
| `compute`      | `(ctx, range) => Promise<number \| null>` | —       | Query function. Required.               |
| `defaultRange` | `string`                                  | `"30d"` | Used when `ctx.range` is missing.       |
| `trend`        | `"vs-previous-period"`                    | —       | Opt-in auto-computed trend.             |

### Range format

`<number><unit>` where unit is `h` / `d` / `w` / `M`. Examples: `"24h"`,
`"30d"`, `"12w"`, `"6M"`. Months use calendar arithmetic (`setUTCMonth`) —
`"6M"` lands on the same day-of-month six months back, not 180 days.

## `timeseries()`

Produces `ChartBucket[]` over a time window. The helper passes `{ start,
end, bucket }` to your `compute`; you run the grouping. Bucket defaults to
one of `hour` / `day` / `week` / `month` based on the range length
(≤48h → hour, ≤60d → day, ≤180d → week, else month).

```ts
const signups = timeseries({
  defaultRange: "30d",
  compute: async ({ db }, { start, end, bucket }) => {
    const { rows } = await db.execute<{ t: string; c: number }>(sql`
      SELECT date_trunc(${bucket}, created_at) AS t, COUNT(*)::int AS c
      FROM users WHERE created_at >= ${start} AND created_at < ${end}
      GROUP BY t ORDER BY t
    `);
    return rows.map((r) => ({ label: fmt(r.t), value: r.c }));
  },
});

w.chart({ label: "Signups", kind: "line", data: signups });
```

## `breakdown()`

Produces `ChartBucket[]` by dimension (e.g. cost by model). Optional `sort`
+ `limit` are applied in-memory after `compute` runs.

```ts
const costByModel = breakdown({
  defaultRange: "30d",
  sort: "value-desc",
  limit: 10,
  compute: async ({ db }, { range }) => {
    const rows = await db
      .select({ label: aiCosts.model, v: sum(aiCosts.costUsd) })
      .from(aiCosts)
      .where(range ? between(aiCosts.createdAt, range.start, range.end) : undefined)
      .groupBy(aiCosts.model);
    return rows.map((r) => ({ label: r.label, value: Number(r.v ?? 0) }));
  },
});

w.chart({ label: "Cost by model", kind: "bar", data: costByModel });
```

## Time-range utilities

```ts
import { defaultBucketFor, parseRange, previousRange } from "@flowpanel/core";

parseRange("7d"); // { start: 7d ago, end: now }
previousRange({ start, end }); // shift back by duration
defaultBucketFor({ start, end }); // "hour" | "day" | "week" | "month"
```
