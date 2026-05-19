---
title: 'Metric helpers'
description: 'A standalone metric / timeseries / breakdown helper module is not implemented today.'
---


> **WIP — planned for vNEXT.** A standalone metric / `timeseries` /
> `breakdown` helper module with built-in range parsing and
> trend calculation is not implemented today.

The shipped surface is the dashboard widget builder
[`metric(label, query, options?)`](../dashboard/#metriclabel-query-options),
which takes an async `query(ctx)` returning `number | string`. Trend
indicators (`delta`, `sparkline`) are user-supplied callbacks on the
same options object — there is no auto-computed previous-period delta
helper yet.

For breakdowns and time series in widgets today, use the chart builders
(`areaChart`, `barChart`, `lineChart`, `pieChart`) from
`@flowpanel/charts` directly; see [Dashboard](../dashboard/).

Tracking issue: see `ROADMAP.md` in the repo for the metric helper
module under post-1.0 work.
