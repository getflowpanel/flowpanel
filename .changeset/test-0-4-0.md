---
"@flowpanel/test": minor
---

- Added `widgetContext`, `resolveWidget` and `headerContext` to `@flowpanel/test/widgets` for unit-testing widgets; without your `admin`, `paths: { admin }` sets the mount their links use.
- Changed `smokeAdmin` to open every detail tab; `tabs: false` skips them.
- Changed `@playwright/test` to an optional peer, since `@flowpanel/test/widgets` runs under Vitest alone.
