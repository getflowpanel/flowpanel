---
"@flowpanel/react": patch
---

A `LocalTime` keeps a configured `formatting.timeZone` after hydration instead of switching to the viewer's zone, so one page shows one clock. Without a configured zone, or with an explicit `fallbackTimeZone`, it still switches.
Widget tones are visible: a `stat`, `metric`, `statGroup` or `kv` value takes the tone's text color, a `bars` row its fill, and a `list` row a leading dot, with colored text for `warn` and `err`.
Long card text wraps: stat and metric hints, `kv` values, `list` text and meta, and `bars`/`funnel` labels show up to two lines and carry the full text in `title`.
A `list` card keys rows by `row.key` or their position instead of their text, so two identical rows no longer raise a duplicate-key error.
`StatGroupCard` renders a stat with an `href` as a link.
A `stat` card title uses the `metric` card's sentence-case style instead of small uppercase, so the two read alike in one row; `kv` and `statGroup` item labels stay uppercase.
Badge cells show `format.labels[value]` when set, with the tone still keyed by the raw value; `StatusBadge` takes an optional `label`.
The table row count, the bulk bar and a multi-select filter use `labels.plurals` when set, picking the form with `Intl.PluralRules` for `formatting.locale`; the string labels work as before.
`BarsCard` takes `max`, so a rate chart can draw 45% as 45% of the track.
A funnel card marks the step with the largest drop-off in the `warn` tone, label and bar, when it loses more than `alertDrop` of the step before.
`useRowHrefClick(rows, rowHrefs)` is the row click every table with per-row hrefs uses.
A `bars` card treats a `max` of zero or less as unset, a funnel reads no drop into a negative step value, and bars and funnel steps are keyed by position so repeated labels raise no duplicate-key error.
A metric delta and funnel shares and drop-offs format their percentages in the admin's `formatting.locale`, so a Russian admin reads «19,4 %» instead of «19.4%».
The Radix dependencies take the current 1.x/2.x family as their lower bounds, the versions a fresh host install resolves, so the bundle carries one `@radix-ui/react-primitive` and one `@radix-ui/react-slot`.
A funnel step that grows over the step before shows «+50%» instead of a negative drop, and `kv` and `statGroup` items are keyed by position so repeated labels raise no duplicate-key error.
