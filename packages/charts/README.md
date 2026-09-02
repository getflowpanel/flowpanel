# @flowpanel/charts

Lazy-loaded chart builders for FlowPanel widgets. Recharts under the hood.

[![npm](https://img.shields.io/npm/v/@flowpanel/charts.svg)](https://www.npmjs.com/package/@flowpanel/charts)

> Most users import from **`@flowpanel/kit/charts`** (umbrella subpath).

## Builders

```ts
import { areaChart, barChart, lineChart, pieChart } from "@flowpanel/kit/charts";

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

`@flowpanel/kit/charts` is **lazy** — it doesn't count toward the initial admin bundle and only loads when a chart widget renders. The package's own runtime is budgeted at 8 KB (`.size-limit.json`); `recharts` is a peer dependency, loaded alongside it, not shipped in the package.

## Documentation

<https://flowpanel.tech>

## License

MIT
