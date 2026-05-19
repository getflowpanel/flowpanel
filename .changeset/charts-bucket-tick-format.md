---
"@flowpanel/charts": patch
"@flowpanel/core": patch
---

Chart x-axis ticks for date-like values are now formatted by `bucket`. Daily/weekly/monthly/yearly buckets render `YYYY-MM-DD` (no `00:00:00` noise); hour/minute buckets render `YYYY-MM-DD HH:mm`; non-date categorical values pass through unchanged. New optional `bucket?: ChartBucket` on `ChartOptionsBase` (additive, no break). When `bucket` is unset or `"auto"`, the helper infers from gaps between the first ~5 x-values.
