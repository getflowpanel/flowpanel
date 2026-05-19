---
"@flowpanel/next": patch
"@flowpanel/adapter-prisma": patch
---

Finish the `Adapter` `any → unknown` migration that started in chore(phase-0). Two more `ListQueryContext<Row>` / `ListQueryContext<Record<string, unknown>>` annotations slipped through in `packages/next/src/pages/resource-list.tsx` and `packages/next/src/runtime/render-widget.tsx` — both now match the adapter signature (`ListQueryContext<unknown>`). The Prisma integration test was also relying on the old `any` widening at adapter return sites; narrowed with explicit `as TestRow` casts.
