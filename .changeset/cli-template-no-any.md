---
"@flowpanel/cli": patch
---

`flowpanel init` scaffolds no longer ship with `as any` in the generated `auth.role` callback. Both drizzle and prisma templates now use a narrow type assertion `(s as { user?: { role?: string } } | null | undefined)` that users can refine via `FlowpanelTypes` augmentation.
