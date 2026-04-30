---
"flowpanel": minor
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
"@flowpanel/client": minor
"@flowpanel/adapter-drizzle": minor
"@flowpanel/cli": minor
---

M1 — Core Runtime. First public alpha of FlowPanel.

- `defineAdmin(config)` + `resource(ref, options)` DSL with strict TS.
- Drizzle adapter: introspection, drizzle-zod schema inference, CRUD.
- React UI: design tokens, shadcn-style primitives, DataTable with
  keyboard navigation, AutoForm (conform + React 19 `useActionState`),
  AdminShell.
- Next.js runtime: catch-all `Flowpanel(config)` page, Server Actions,
  minimal SSE stream, per-request context via AsyncLocalStorage.
- CLI: `init`, `migrate`, `doctor` with @clack/prompts.
- `flowpanel` aggregator: single public entry with 7 subpaths
  (`flowpanel`, `/next`, `/drizzle`, `/react`, `/client`, `/server`,
  `/bullmq`).
