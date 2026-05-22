---
"@flowpanel/cli": minor
"flowpanel": patch
---

`flowpanel init` now produces a runnable admin scaffold end-to-end. Previously the user got the FlowPanel files but no `app/layout.tsx`, no `tailwind.config.ts`, and no CSS import — so `/admin` rendered unstyled. Init now: writes/patches `app/layout.tsx`, detects Tailwind v3 vs v4 and writes the matching token sheet, reads tsconfig `paths` to emit correct alias paths, and detects `src/db/client.ts` (which the in-repo example actually uses).

The `flowpanel` umbrella peerDep is now `tailwindcss: ^3 || ^4` until v4 becomes the example's default.
