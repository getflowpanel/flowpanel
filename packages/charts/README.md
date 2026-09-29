# @flowpanel/charts

Line, area, bar and pie chart widgets for FlowPanel dashboards, rendered with Recharts and loaded only when a chart is on the page. Apps use it as `@flowpanel/kit/charts`.

## Install

```bash
pnpm add recharts
```

## Example

```ts
import { lineChart } from "@flowpanel/kit/charts";

lineChart("Signups", async ({ db, dateRange }) => dailySignups(db, dateRange), {
  x: "day",
  y: "count",
});
```

[Charts](https://flowpanel.tech/docs/customization/charts) · MIT
