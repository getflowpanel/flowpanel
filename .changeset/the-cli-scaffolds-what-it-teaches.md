---
"@flowpanel/cli": patch
---

Generate the code the documentation teaches, in every environment.

- `flowpanel new` writes `resource(schema.orders, {})` — the DSL lists every
  introspected column until narrowed — instead of `{ columns: ["id"] }`, and
  no longer erases Prisma ref typing with `resource<unknown>`.
- The install spinner renders only on a TTY; piped and CI runs get plain log
  lines instead of kilobytes of ANSI redraw frames.
- `eject` with an unknown target and `migrate` without a config answer in JSON
  when `--json` is set, like every other failure path.
- With no path alias and the App Router under `src/app`, the scaffolded layout
  imports `admin.css` from the right depth instead of a nonexistent path.
- The ejected create-page hint names the export `actions.ts` actually has.
