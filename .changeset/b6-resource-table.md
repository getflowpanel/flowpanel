---
"@flowpanel/core": minor
"@flowpanel/react": minor
---

**B6 — ResourceTable refinements.**

- CSV export: `downloadCsv(filename, rows, columns)` + `toCsv(rows, columns)` helpers in `@flowpanel/react`.
- Toolbar renders an **Export CSV** button when `defineResource({ export: true })` is set. Exports the currently-visible rows (server-side streaming is out of scope).
- BulkActionBar now surfaces `dialog`-typed actions too — the typed builder's `bulkEdit` action is lowered to a dialog and becomes clickable from the selection bar.
- `SerializedResource.flags` exposes `{ realtime, export }` for client UI to key off without leaking implementation details.
