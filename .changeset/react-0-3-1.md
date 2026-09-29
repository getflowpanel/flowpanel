---
"@flowpanel/react": patch
---

0.3.1 ships the React side of the four new widgets, colours every widget by its tone, and moves
to `tailwind-merge@^3` so Tailwind v4 utilities merge correctly. See the
[0.3.1 upgrade notes](https://flowpanel.tech/docs/guides/upgrade#upgrading-from-030-to-031) for
the full list; the sections below cover the rest, grouped by what you'd touch.

**New cards.** `TimelineCard` (kind chips in a labelled group, day groups, folded and bodied
lines that open from a chevron with no link inside the toggle, and paging, with no client state),
`HeatmapCard` (day cells in four quartile steps shaded by class, with month and weekday labels, a
legend and a summary read once; linked days take one tab stop and move with the arrow keys),
`ChecklistCard` (a mark per item, dates and gaps, a summary bar and a `steps` layout),
`TrackerCard` (toned blocks with accessible names, summaries aligned on desktop and wrapped on a
phone, a cut label or summary whole in its tooltip), `ListBanner` for
`list({ variant: "banner" })`, whose rows clamp their text and their count, age and meta to two
lines so they fit a phone, `StatStrip` (numbers in one
hairline band drawn on the cells, so an unfilled last line stays blank, two per line on a phone,
with `plain` on `MetricCard` and `StatCard`) and `ExpiredCard`, which takes `plain` inside a
strip, as `ErrorCard` now does. Every widget card takes a `caption`, shown under its title by `CaptionLine` with a ▲ when
stale, and `CardHeading` pairs the two.

**Cells.** A `relative` time is a `<time>` with the exact timestamp in its tooltip, a `url` a
link that opens an absolute URL in a new tab without opening the row, `{ kind: "percent", heat:
true }` a cell shaded by its value, and a `boolean` a glyph read as yes or no; `HeatCell`,
`UrlCell`, `RelativeTimeCell`, `BooleanCell` and `ToneText`, which colours a number by its
`tones`, are exported for custom cells. Badge cells show `format.labels[value]`, and
`StatusBadge` takes a `label`. `DataTableColumn.secondary` shows a muted second line in the
table and the phone card list. `spanClass` covers every span from 1 to 12.

**Cards.** A metric card's change has a neutral band inside ±1 %, prints its percentage in the
admin's locale, shows the compared value beside it, and reads as an absolute change (`+3`) for a
count under 20 or in points (`+3 pp`) for a `percent` metric. `BarsCard` takes `max` and shows
each row's `share` and its change against `previous`. A funnel marks the step with the largest
drop-off in the `warn` tone past `alertDrop`, and shows growth as «+50%». Lists show a row's
`count`, `since` and a "N more" line (`more: { label, href? }`, the shape of a timeline's paging
links), every card takes `emptyState` as text or any node, and `StatGroupCard` renders a stat
with an `href` as a link. `KvCardItem` takes `long`, `rest` and `more` for a folded paragraph.
`PageHeader` takes `badges`, several pills each with an optional link. `StatusDot` takes every
tone, and `toneTextClass` and `toneFillClass` are exported for custom widgets.
`useRowHrefClick(rows, rowHrefs)` is the row click of every table with per-row hrefs.

**Pickers and navigation.** `DateRangePicker` takes `presets` and shows a custom `from`/`to` as
its two days in the admin's zone; the date filter chip names a preset such as `last7d`, marks it
when the picker opens and reads a `from~to` pair of instants as two days. `NavGroup` takes
`collapsible`, and `AdminNav` folds such a group in a `<details>`, open while it holds the
current page. `useAdminDrawer` keeps the drawer's tab in `?drawerTab=` and no longer reads
`?tab=`, so a drawer over a record page leaves the page's tab alone and never opens on it. A
collapsible nav group's header is as tall as a nav item on a phone.

**Behaviour changes.** A `LocalTime` keeps a configured `formatting.timeZone` after hydration
instead of switching to the viewer's zone; without one, or with a `fallbackTimeZone`, it still
switches. Widget tones are visible: a `stat`, `metric`, `statGroup` or `kv` value takes the
tone's text colour, a `bars` row its fill and a `list` row a leading dot. Stat and metric hints,
Metric and stat titles, `kv` and `statGroup` values, `list` text and `bars` and `funnel` labels wrap to two lines with
the full text in `title`, and a metric's sparkline moves under its value on a narrow card. A
banner row, a toned list row and a stale caption say their tone to a screen reader, in the words
of `labels.widget.tones`. A `stat` card title uses the `metric` card's sentence case. Metric
deltas and funnel percentages use the admin's locale. The row count, the bulk bar and a multi-select filter use
`labels.plurals`, and the row count prints its number in `formatting.locale`, the locale that
picks its noun. `tailwind-merge` moves to `^3.0.0`, so `cn()` merges Tailwind v4 utilities such
as `inset-shadow-*` and `field-sizing-*`, and the Radix dependencies take the current 1.x and 2.x
releases as lower bounds, so an app bundles one `@radix-ui/react-primitive` and one
`@radix-ui/react-slot`.

**Fixes.** List rows, bars, funnel steps and `kv` and `statGroup` items are keyed by position or
`key`, so repeated labels raise no duplicate-key error. A `bars` `max` of zero or less is unset,
and a funnel reads no drop into a negative step. Unused `ui` wrappers no longer land in an app's
bundle, and the build produces the same chunks from the same source.

**Default look.** A graphite palette with an ink accent, one calm data colour (`--fp-data`, after
`--fp-chart-1`) for bars, funnels, sparklines and heat, desaturated tones, a dark mode whose page
sits below its cards, smaller radii and no resting shadow; every text token reads at 4.5:1 or
more. Labels, table headers and nav groups are sentence case, the active nav item and tab are
neutral, card links are secondary text, and badges have 4 px corners. A healthy status such as
`active` is neutral, `disabled` and `canceled` are muted, and only failures, warnings and work
in progress are coloured. Metric and bar
changes are plain signed text coloured from a 5 % change, list lines keep the body colour, the
banner leads with its worst row as a sentence on a neutral card with a tone rule, empty cards
take one line, and error cards name the failure in the error colour. A funnel tones a step only
past `alertDrop`.

**Tables and drawers.** Compact rows are 40 px, Export hides at 0 rows, a phone folds a page past
10 cards behind one button, and a long drawer value wraps. The drawer takes focus on open.

**Error cards.** A failed widget card keeps the error's message in a closed «Details» disclosure outside production instead of printing it on the card.

**Titles.** Card titles are secondary text at regular weight and section titles semibold, so a section reads above its cards.

**Strip figures.** A `stat` and an expired cell in a `StatStrip` draw their value at the `metric`'s 32 px, so a strip has one figure size.

**Funnel warn.** A funnel step past `alertDrop` tones its bar and drop only; its label stays in secondary text.

**Lists past page one.** Column `render` cells show on every page of a list; page 2 and later used to fall back to the raw value.

**Right-aligned sort.** A sortable right-aligned header puts its sort icon before the label, so the label ends over the figures.

**Failed widgets.** `ErrorCard` takes a `title`, and a failed widget's card shows the widget's own title with the failure line under it.

**Strip hints.** A `stat` hint sits as close under its figure as a `metric` sublabel.
