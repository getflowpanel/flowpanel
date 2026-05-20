# Dashboard

A **dashboard** is a page of widget sections, registered in `defineAdmin({ dashboards })`. Widgets are pure async functions that run server-side; the client only receives the resolved data.

```ts
import { dashboard, defineAdmin, metric, table } from "flowpanel";
import { areaChart } from "flowpanel/charts";

defineAdmin({
  ...,
  dashboards: [
    dashboard({
      path: "/",
      label: "Overview",
      dateRange: { preset: "last7d" },
      sections: [
        {
          label: "Today",
          columns: 4,
          widgets: [
            metric("Users", async ({ db }) => db.user.count()),
            metric("Active jobs", async ({ db }) => db.job.count({ where: { archived: false } })),
          ],
        },
        {
          label: "Signups",
          widgets: [
            areaChart(
              "Signups",
              async ({ db, dateRange }) => loadDailySignups(db, dateRange),
              { x: "day", y: "count", smooth: true, height: 220 },
            ),
          ],
        },
        {
          label: "Recent users",
          widgets: [
            table({ resource: "user", limit: 10, rowClick: "drawer" }),
          ],
        },
      ],
    }),
  ],
});
```

## `dashboard(config)`

```ts
dashboard({
  path: string,           // route under the admin shell, e.g. "/" or "/monitoring"
  label: string,
  icon?: string,
  dateRange?: DateRangeConfig,
  realtime?: string | string[],
  sections: SectionConfig[],
})
```

### `DateRangeConfig`

```ts
{
  preset?: "today" | "yesterday" | "last7d" | "last30d" | "MTD" | "QTD" | "YTD",
  default?: { from: Date; to: Date },
  allowCustom?: boolean,
}
```

The resolved range lands in every widget's `ctx.dateRange` as `{ from, to, preset }`.

### `SectionConfig`

```ts
{
  label?: string,
  description?: string,
  columns?: 1 | 2 | 3 | 4 | 6 | 12,
  widgets: WidgetConfig[],
}
```

`columns` controls the section grid; widgets without `span` fill one column.

## Widget builders

All widgets share a server-side `ctx`:

```ts
interface WidgetContext {
  db: InferDB;                 // your typed adapter db
  session: Session | null;
  dateRange: ResolvedDateRange;
  req: Request;
}
```

### `metric(label, query, options?)`

```ts
metric(
  label: string,
  query: (ctx: WidgetContext) => Promise<number | string>,
  options?: {
    icon?: string,
    format?: "number" | "currency" | "percent" | "bytes" | "duration",
    sublabel?: string,
    delta?: (ctx) => Promise<{ value: number; vs: string } | null>,
    sparkline?: (ctx) => Promise<number[]>,
    tone?: "default" | "accent" | "success" | "warning" | "danger" | "muted",
    drilldown?: string,
    drawer?: { resource: string; id?: (value: unknown) => string },
    span?: 1 | 2 | 3 | 4 | 6 | 8 | 12,
    realtime?: string | string[],
  },
)
```

### `table(options)`

```ts
table({
  label?: string,
  resource?: string,                                   // pull rows from a registered resource
  query?: (ctx) => Promise<unknown[]>,                 // or an inline loader
  columns?: string[],
  limit?: number,
  rowClick?: "drawer" | "detail" | ((row) => void),
  emptyState?: ReactNode,
  realtime?: string | string[],
  span?: Span,
})
```

Either `resource` or `query` is required.

### `statGroup(options)`

A compact row of related stats inside one card.

```ts
statGroup({
  label?: string,
  span?: Span,
  stats: Array<{
    label: string,
    value: unknown | ((ctx, row?) => Promise<unknown>),
    format?: "number" | "currency" | "percent" | "bytes" | "duration",
    tone?: Tone,
  }>,
})
```

### `custom(Component, props, options?)`

Your React component, your data loader. The server runs `props(ctx)` (or uses the static value) and the client mounts the component with the resolved props.

```ts
custom(Funnel, async ({ db, dateRange }) => loadFunnel(db, dateRange), {
  span: 12,
  realtime: "resource.user",
})
```

### Charts — `flowpanel/charts`

```ts
import { areaChart, barChart, lineChart, pieChart } from "flowpanel/charts";
```

Each takes `(label, query, options)`:

```ts
areaChart(label, query, { x, y, height?, format?, tooltip?, drilldown?, span?, realtime?, bucket?, stacked?, smooth? })
barChart (label, query, { x, y, ..., bucket?, stacked?, horizontal? })
lineChart(label, query, { x, y, ..., bucket?, smooth?, markers? })
pieChart (label, query, { category, value, donut?, showLegend?, height?, span?, drilldown?, realtime? })
```

`query` returns the raw rows; `x` / `y` / `category` / `value` are the field keys the chart reads from each row.

### X-axis bucket — `ChartBucket`

`areaChart`, `barChart`, and `lineChart` accept an optional `bucket` that
controls x-axis tick formatting when the x-values are dates. Type
(`packages/core/src/types/widget.ts:98`):

```ts
type ChartBucket = "minute" | "hour" | "day" | "week" | "month" | "year" | "auto";
```

| Bucket | Tick format |
|---|---|
| `"day"`, `"week"`, `"month"`, `"year"` | `YYYY-MM-DD` (date only) |
| `"hour"`, `"minute"` | `YYYY-MM-DD HH:mm` |
| `"auto"` *(default)* | Infers from spacing between the first ~5 points: all gaps ≥ 23h → `"day"`, else `"hour"`. |

```ts
lineChart(
  "Signups per day",
  async ({ db, dateRange }) => loadDailySignups(db, dateRange),
  { x: "day", y: "count", bucket: "day", height: 220 },
)
```

Source: `packages/charts/src/runtime/format-tick.ts`. `pieChart` has no
`bucket` option (no x-axis).

## Widget context lifecycle

Widgets are evaluated server-side per request. There's no shared cache — if two widgets hit the same expensive query, factor it out to a helper that both call. Errors thrown inside a `query` are caught at the section boundary so a failing widget can't blank the page.

## Realtime

Set `realtime` on a widget (or on the dashboard) to a channel name to re-fetch its data when that channel publishes:

```ts
metric("Users", async ({ db }) => db.user.count(), { realtime: "resource.user" })
table({ resource: "user", realtime: "resource.user" })
dashboard({ ..., realtime: ["resource.user", "resource.job"] })
```

`resource.<name>` channels fire automatically on any mutation through that resource (see `docs/reference/realtime.md`).
