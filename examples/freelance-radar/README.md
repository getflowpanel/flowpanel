# freelance-radar — FlowPanel 1.0 spec

> **This directory is not executable yet.** It holds the target API surface
> for FlowPanel 1.0 as a runnable-shaped example. The config compiles once
> the **B1 (typed resource builder)**, **B2 (metrics builder)**, **B5
> (realtime)**, **B7 (theme tokens)**, and **B8 (widget namespace)** tasks
> land. Until then, treat `src/flowpanel.ts` as a reviewable contract.

## Why this exists

FlowPanel is designed for a specific shape of product — a Next.js SaaS
backed by Drizzle or Prisma, needing a CRUD admin with realtime signals,
custom domain tabs, and one-click actions against production data.

`freelance-radar` is a synthetic-but-realistic target: 5 tables, enums,
self-referential category tree, JSONB columns, Russian payment flow
(YuKassa), AI cost tracking. If the 1.0 API can model this admin in
≤300 LOC with zero `any` and full type inference, it's ready.

## Layout

```
src/
├── db/
│   └── schema.ts              # Drizzle: 5 tables, enums, relations
├── pages/
│   ├── CategoryTreeEditor.tsx # custom page (drag-and-drop tree)
│   └── AiCostsDetailPage.tsx  # custom report page
├── lib/
│   ├── auth.ts                # getSession stub
│   └── ukassa.ts              # YuKassa refund stub
└── flowpanel.ts               # THE CONFIG (target API)
```

## Checklist (used to validate the 1.0 API)

- [ ] `src/flowpanel.ts` typechecks with `strict: true`
- [ ] ≤ 300 LOC
- [ ] 0 `any`, 0 non-null assertions (`!`)
- [ ] ⌘Click on any column reference jumps to the Drizzle schema
- [ ] Renaming `users.email` in schema → red squiggle in config
- [ ] `npm run dev` serves a working admin with all 4 resources
- [ ] `realtime: true` widgets update on INSERT from another session (≤ 2s)
- [ ] `components` prop on `<FlowPanelUI>` can swap the `<Button>` primitive
- [ ] `npx flowpanel add resource-table` copies the component for local edit
