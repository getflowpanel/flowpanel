---
"@flowpanel/react": minor
"@flowpanel/next": patch
---

`LocalTime` — render absolute timestamps in the viewer's timezone.

New `<LocalTime>` atom (exported from `@flowpanel/react`) formats a `Date` or
ISO string in the **browser's** local zone instead of the server's. Server
Components can't read the viewer's timezone, so a server-formatted date always
reflects the deployment zone (UTC in most containers) — the classic "the
dashboard clock is hours off" bug. `LocalTime` renders a deterministic
`fallbackTimeZone` value during SSR and the client's first paint (so hydration
matches byte-for-byte, no warning), then a `useEffect` upgrades it to the
viewer's local zone. Pairs with the existing relative `<TimeAgo>` (which is
timezone-agnostic and never mismatches the device).

The formatting **locale** is pinned to a fixed `"en-CA"` by default. Leaving the
locale unset would resolve to the runtime's default locale — Node's on the
server, `navigator.language` on the client — re-introducing a hydration mismatch
whenever the two differ (e.g. Node `en-US` vs. browser `ru-RU`). Pinning it
keeps SSR deterministic and leaves the displayed date **format unchanged** from
before — only the TIMEZONE becomes viewer-local. With neither `locale` nor
`options` passed, the output matches the framework's prior sortable format
(`2026-05-29 14:30`). Callers wanting localized formatting pass an explicit
`locale`.

Generic cell rendering now goes through it. `DataTable` rows and resource
detail pages render `Date` / ISO-datetime values via `LocalTime` (new
`renderCellValue` helper), so admin tables and detail views show device-local
time. `formatCell` is unchanged and still returns plain strings for CSV export
and server prerender-to-string. This also removes a duplicated date formatter
in `@flowpanel/next`'s resource-detail page.

API:
- `LocalTime` (component) + `LocalTimeProps` (type) — new exports from
  `@flowpanel/react`.
- `renderCellValue(v)` — internal cell renderer used by `DataTable`; not part
  of the public surface.
