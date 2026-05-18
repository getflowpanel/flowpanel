# @flowpanel/charts

Lazy-loaded chart builders for FlowPanel widgets. Recharts under the hood.

[![npm](https://img.shields.io/npm/v/@flowpanel/charts.svg)](https://www.npmjs.com/package/@flowpanel/charts)

> Most users import from **`flowpanel/charts`** (umbrella subpath).

## Builders

```ts
import { areaChart, barChart, lineChart, pieChart } from "flowpanel/charts";

dashboard({
  path: "/",
  sections: [
    {
      label: "Signups",
      columns: 1,
      widgets: [
        areaChart(
          "Signups (last 7 days)",
          async ({ db, dateRange }) => /* return rows */,
          { x: "day", y: "count", smooth: true, height: 220 },
        ),
      ],
    },
  ],
});
```

## Bundle

`flowpanel/charts` is **lazy** — it doesn't count toward the initial admin bundle. The 60 KB charts payload only loads when a chart widget renders.

## Documentation

<https://flowpanel.dev>

## License

MIT
