---
"@flowpanel/charts": patch
---

A chart's value axis prints a duration in its largest unit with one decimal — `2.1h`, `42s`, `2,1 ч` — so it fits the axis; the tooltip prints the full `2 hr 5 min`.
`ChartRenderer` takes the card's link as a resolved `drilldown` prop, and `chartFrame` wraps a chart card in it; the server strips the option before it reaches the browser.
