---
"flowpanel": minor
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
---

Bulk Actions — declared in `ResourceOptions.bulkActions` since 1.0.0, now
actually implemented end-to-end.

- **Server:** `POST /api/flowpanel/<resource>/bulk-actions/<key>` runs the
  action with `(ids, input, ctx)`. Body is JSON `{ ids, input? }` (canonical)
  or form-data with one or more `ids` fields. The action is treated as
  atomic — its `ActionResult` is the single outcome. Audit emits
  `<resource>.bulk.<key>` with a cap of 10 IDs in `targetId` to keep audit
  rows reasonable.
- **UI:** floating `<BulkActionsBar>` appears above the table when one or
  more rows are selected: `N selected — [Action ▾] [Clear]`. The kebab
  picks an action; `confirm` reuses `<ConfirmDialog>`; result goes through
  `triggerDownload` / `router.push` / toast like row actions.
- **Selection state:** local React state in `DataTableWithDrawerRows` for
  Phase 0; URL persistence (`?selected=...`) lands with Phase 1's saved
  views work.
- **`BulkAction.requireRole`** — checked after the resource-level role.
- **`BulkAction.variant: "destructive"`** — destructive confirm + red item
  in the dropdown.

Closes the second item of Phase 0 in `docs/spec/1.x-roadmap-to-10-of-10.md`.
