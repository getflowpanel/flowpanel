---
"@flowpanel/react": patch
---

`ToneText` colours a numeric cell by its threshold, and `renderFormatCell` uses it for a format with `tones`.
Every widget card takes a `caption`, shown under its title by `CaptionLine` with a ▲ when stale. `CardHeading` pairs a title with its caption, and `ExpiredCard` shows a widget whose range is older than its data is kept.
`TrackerCard` draws a tracker's rows as toned blocks with accessible names, wrapping each summary under its label on a phone.
`ListCard` renders `variant: "banner"` through `ListBanner`, with severity glyphs, a tint by the worst row and an all-clear line. Every list shows a row's formatted `count` and `since` beside its meta, and a "N more" line.

`TrackerCard` gives every row's summary the same fixed width on desktop, so the hour strips line up down the column.
