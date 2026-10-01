---
"@flowpanel/react": minor
---

- Added `TimelineCard`, `HeatmapCard`, `ChecklistCard`, `TrackerCard`, `StatStrip` and `ListBanner`.
- Added `HeatCell`, `UrlCell`, `RelativeTimeCell`, `BooleanCell` and `ToneText` for custom cells.
- Changed the default look to a graphite palette with one data colour, `--fp-data`.
- Changed widget values, bar fills and list dots to show their tone.
- Changed `LocalTime` to keep a configured `formatting.timeZone` after hydration.
- Changed the drawer to keep its tab in `?drawerTab=` instead of `?tab=`.
- Changed `tailwind-merge` to `^3.0.0`, so `cn()` merges Tailwind v4 utilities.
- Fixed column `render` cells showing the raw value after page one.
- Fixed duplicate-key errors on repeated labels in lists, bars, funnels and `kv`.
- Changed `MetricCard` to take `goodWhen` as its own prop instead of reading it from `delta`.
- Added `CardDate`, an instant that `StatCard`, `KvCard` and `StatGroupCard` render through `LocalTime`; `StatGroupCard` renders a bare `Date` the same way.
- Fixed a column's `secondary` timestamp rendering in UTC while the cell used the viewer's zone.
- Fixed `FunnelCard` showing `−0%` for a step that loses no one.
- Changed a single click on an editable cell in a clickable row to open the row; editing starts from the pencil or Enter, and `InlineEditCell` takes `rowClickable` for it.
