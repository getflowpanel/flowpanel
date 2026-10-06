---
"@flowpanel/charts": minor
---

- Added `colors` to pin a series to a colour, and a `caption` under the chart title.
- Changed duration axes to print one compact unit, such as `2.1h`.
- Changed vertical bar charts to thin their category ticks so dates never overlap.
- Changed `ChartRenderer` to take the card's link as a `drilldown` href instead of reading `options.drilldown`; pass the resolved link, or the chart card has no link.
- Added `seriesLabels` to `ChartRenderer` to give each series a display name.
- Changed a single-series chart to draw in `--fp-data` and dropped the area gradient.
