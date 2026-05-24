---
"flowpanel": minor
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
"@flowpanel/charts": minor
"@flowpanel/adapter-drizzle": minor
"@flowpanel/adapter-prisma": minor
---

Dogfood-driven 1.0 polish: Zod 4 lock, peer-range relax, DTS augmentation fix.

- **Zod 4 only.** `@conform-to/zod`'s root entry imports `ZodPipeline` which Zod 4 renamed to `ZodPipe`. `@flowpanel/react` now imports `parseWithZod` from `@conform-to/zod/v4` and uses `$ZodType` from `zod/v4/core` for schema generics. Peer `zod` widened to `^4.0.0`; Zod 3 support dropped.
- **Wider peer ranges.** `next: "^15.0.0 || ^16.0.0"` (was `^15.0.0`), `recharts: "^2.15.0 || ^3.0.0"` (was `^2.15.0`), `ioredis: "^5.10.0"` (was `^5.10.1`). Fixes pnpm creating 4 separate virtual stores per peer combo and forcing consumers into `peerDependencyRules.allowedVersions`.
- **DTS augmentation fix.** `packages/core/tsup.config.ts` splits per entry so the bundler stops extracting `FlowpanelTypes` into an internal `config-XXX.d.ts` chunk. The chunk broke `declare module "@flowpanel/core" { interface FlowpanelTypes { db: typeof db } }` augmentation — TS treated the interface inside the internal chunk as a different declaration site than `dist/index.d.ts`, so user augmentation silently dropped and `ctx.db` stayed `unknown`. Now `dist/index.d.ts` declares the interface inline; the augmentation merges and `WidgetContext<InferDB>` resolves the typed DB.
