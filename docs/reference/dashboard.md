# Dashboard

A **dashboard** is a grid of widgets that live-reload every 30 seconds. Widgets are pure async functions that run server-side; the client only receives data (never code), so secrets stay on the server.

```ts
defineFlowPanel({
  ...,
  dashboard: (w) => [
    w.metric({
      label: "MRR",
      format: "money",
      value: async (ctx) => ctx.db.subscription.aggregate({ _sum: { amount: true } }).then(r => r._sum.amount ?? 0),
      trend: async (ctx) => ({ delta: 12, deltaPercent: 8.3, direction: "up", period: "7d" }),
    }),

    w.chart({
      label: "Signups (14d)",
      kind: "bar",
      data: async (ctx) => last14DaySignups(ctx.db),
    }),

    w.list({
      label: "Recent errors",
      layout: { span: 6 },
      rows: async (ctx) => ctx.db.run.findMany({ where: { status: "error" }, take: 5 }),
      render: (run) => ({
        primary: run.partitionKey,
        secondary: run.errorMessage,
        meta: relativeTime(run.createdAt),
      }),
    }),

    w.custom({
      id: "conversion-funnel",
      label: "Signup funnel",
      data: async (ctx) => computeFunnel(ctx.db),
      // component prop is consumed by DashboardPage `components` map (see below)
    }),
  ],
});
```

## Widget kinds

### `w.metric`

Single number or string with an optional trend indicator.

```ts
w.metric({
  label, icon?, description?, layout?,
  format?: "number" | "money" | "percent" | "bytes" | "duration",
  prefix?, suffix?,
  value:  (ctx) => Promise<number | string | null>,
  trend?: (ctx) => Promise<{ delta, deltaPercent?, period?, direction? } | null>,
  sublabel?: string | ((ctx) => Promise<string | null>),
})
```

### `w.list`

Compact list with primary/secondary text and optional badge or link.

```ts
w.list({
  label,
  rows:  (ctx) => Promise<Row[]>,
  render: (row) => ({ primary, secondary?, meta?, badge?, href? }),
  limit?:        // default 10
  emptyMessage?: // default "No … yet"
})
```

### `w.chart`

Lightweight SVG chart (bar / line / area). No chart library added to your bundle.

```ts
w.chart({
  label,
  kind?: "bar" | "line" | "area",   // default "bar"
  data: (ctx) => Promise<Array<{ label: string; value: number }>>,
  color?: string,
  format?: "number" | "money" | "duration",
})
```

### `w.custom`

Your component, your data loader. The server runs `data(ctx)`, the client mounts your React component with the resolved payload.

```ts
// flowpanel.config.ts — server side
w.custom({
  id: "conversion-funnel",
  label: "Signup funnel",
  data: async (ctx) => ({ steps: [...] }),
})
```

```tsx
// app/admin/page.tsx — client side
import { ConversionFunnel } from "@/components/funnel";

<FlowPanelUI
  config={config}
  trpcBaseUrl="/api/trpc"
  // DashboardPage wires this automatically when using <FlowPanelUI />.
  // If you render DashboardPage directly, pass it via components:
  components={{ "conversion-funnel": ConversionFunnel }}
/>
```

## Layout

Widgets render in a 12-column grid. Default spans:

| Widget | Span |
|---|---|
| `metric` | 3 |
| `list` | 6 |
| `chart` | 12 |
| `custom` | 12 |

Override per-widget with `layout: { span: 4 }`. Valid values: `1 | 2 | 3 | 4 | 6 | 8 | 12`.

## Error handling

If a widget's data loader throws, that widget shows the error inline and the rest keep loading independently. FlowPanel never fails the whole page for a single bad query.
