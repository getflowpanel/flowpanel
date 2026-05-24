---
"flowpanel": minor
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
---

Row Actions — declared in `ResourceOptions.actions` since 1.0.0, now actually
implemented end-to-end.

- **Server:** `POST /api/flowpanel/<resource>/<id>/actions/<key>` runs the
  action against the loaded row. Auto-emits audit (`<resource>.action.<key>`)
  and auto-publishes the resource channel on success. Re-evaluates `hidden`
  and `disabled` server-side as defense-in-depth.
- **UI:** trailing sticky-right cell rendered when `actions[].length > 0`.
  Menu-placement actions land in a kebab dropdown; `placement: "inline"`
  actions render as outline buttons. `confirm` uses `<ConfirmDialog>`; the
  click handler stops propagation so triggering an action never opens the
  drawer behind it.
- **`RowAction.placement: "inline" | "menu"`** — default `menu`.
- **`RowAction.requireRole`** — checked after the resource-level role.
- **`RowAction.disabled(row): boolean | string`** — string reason is surfaced
  to the user as a 409 error toast.
- **`RowAction.hidden(row, ctx): Promise<boolean>`** — also evaluated
  server-side; a hand-crafted POST against a hidden row 404s.

Closes the first item of Phase 0 in `docs/spec/1.x-roadmap-to-10-of-10.md`.
