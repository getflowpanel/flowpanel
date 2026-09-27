---
"@flowpanel/charts": patch
---

Area, bar and line charts name each series from the names the server hands them and treat a missing `y` as no series. A chart card shows its `caption` under the title, and `ChartRenderer` takes the card's link as a resolved `drilldown` prop, which `chartFrame` wraps around the card with a focus ring; the card stretches to its row like every other card and draws no empty heading without a title. A duration on the value axis prints in its largest unit with one decimal (`2.1h`, `42s`, `2,1 ч`) so it fits, while the tooltip prints the full `2 hr 5 min`.

A single series draws in `--fp-data`, `colors` pins a series to a colour by key, the legend writes names in secondary text beside a swatch, ticks inside one year drop the year, area charts fill flat, and an empty chart is one line.
