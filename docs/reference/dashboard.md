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

## Sections

Past roughly eight widgets a flat grid becomes hard to scan. Group them with `sections` — each section gets a heading and optional description, and the grid resets underneath:

```ts
dashboard: {
  sections: [
    {
      title: "Revenue",
      description: "30-day MRR with trend vs previous period.",
      widgets: (w) => [
        w.metric({ label: "MRR", format: "money", prefix: "$", ...mrr }),
      ],
    },
    {
      title: "Growth",
      widgets: (w) => [
        w.chart({ label: "Sign-ups", kind: "line", data: signups }),
      ],
    },
  ],
};
```

The server flattens all widgets from every section into one batch, so performance matches a flat dashboard; the client restores the visual grouping.

## With metric / timeseries / breakdown helpers

`w.metric` wants `{ value, trend }`; `w.chart` wants `{ data }`. The `metric()` / `timeseries()` / `breakdown()` helpers from `@flowpanel/core` return exactly those shapes, so you write the query once and spread it:

```ts
import { breakdown, metric, timeseries } from "@flowpanel/core";

export const mrr = metric({
  defaultRange: "30d",
  trend: "vs-previous-period",
  compute: async ({ db }, { start, end }) =>
    db.payment.aggregate({
      _sum: { amount: true },
      where: { status: "succeeded", paidAt: { gte: start, lt: end } },
    }).then((r) => r._sum.amount ?? 0),
});

export const signups = timeseries({
  defaultRange: "30d",
  compute: async ({ db }, { start, end, bucket }) =>
    groupSignupsByBucket(db, { start, end, bucket }),
});

export const spendByModel = breakdown({
  defaultRange: "30d",
  sort: "value-desc",
  limit: 10,
  compute: async ({ db }, { range }) => spendGroupedByModel(db, range),
});

// Then:
dashboard: (w) => [
  w.metric({ label: "MRR", format: "money", prefix: "$", ...mrr }),
  w.chart({ label: "Sign-ups", kind: "line", data: signups }),
  w.chart({ label: "Spend by model", kind: "bar", data: spendByModel }),
]
```

Why this split: trend math ("vs previous period") and bucket resolution are boilerplate most dashboards repeat. The helpers own that, the widget builder owns presentation.

## Recipes

### Status banner + sparkline inside a custom widget

The screenshots on the landing page (health strip, per-platform cards with mini charts) don't ship as built-in widget kinds — they're one generic `w.custom` each, rendered by small components you own. Copy a template:

```bash
pnpm flowpanel add status-banner
pnpm flowpanel add sparkline
```

Now wire them into a custom widget:

```ts
// flowpanel.config.ts
dashboard: (w) => [
  w.custom({
    id: "health",
    label: "Health",
    layout: { span: 12 },
    data: async ({ db }) => ({
      status: await probeSystems(db),
      parserTrend: await last24hParserOps(db),
    }),
  }),
],
```

```tsx
// app/admin/page.tsx
import { StatusBanner } from "@/flowpanel/widgets/StatusBanner";
import { Sparkline } from "@/flowpanel/widgets/Sparkline";

function HealthWidget({ data }: { data: { status: "ok" | "warn" | "error"; parserTrend: number[] } }) {
  return (
    <div className="space-y-3">
      <StatusBanner status={data.status} message="All systems operational" />
      <Sparkline data={data.parserTrend} width={240} height={40} />
    </div>
  );
}

<FlowPanelUI config={config} components={{ health: HealthWidget }} />
```

This is the shadcn philosophy applied to dashboards: composition over prop-drilling, and the component is a file you own — not a dependency to pin.

## Error handling

If a widget's data loader throws, that widget shows the error inline and the rest keep loading independently. FlowPanel never fails the whole page for a single bad query.
