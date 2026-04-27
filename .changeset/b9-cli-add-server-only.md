---
"@flowpanel/cli": minor
---

**B9 — CLI scaffolding polish.**

- `flowpanel init` now emits `import "server-only"` at the top of the
  generated `flowpanel.config.ts`, satisfying `doctor --boundary-check`
  out of the box.
- New `flowpanel add <widget>` — shadcn-style scaffolder that copies a
  widget template into `src/flowpanel/widgets/`. The user owns the file;
  edit freely, no FlowPanel upgrade will stomp it.
- Bundled templates: `stat-card`, `timeline`, `kv`. Each imports only
  public `@flowpanel/react` primitives so the copy works without pulling
  in internals.
