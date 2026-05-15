---
"flowpanel": major
"@flowpanel/core": major
"@flowpanel/next": major
"@flowpanel/react": major
"@flowpanel/adapter-drizzle": major
"@flowpanel/adapter-prisma": major
"@flowpanel/adapter-bullmq": major
"@flowpanel/charts": major
"@flowpanel/cli": major
"@flowpanel/client": major
---

M4a — Prisma adapter, eject CLI, theme.components, labels, motion + a11y polish.

**New: `@flowpanel/adapter-prisma`** — DMMF runtime introspection, CRUD with soft-delete + restore + restore-list filter, parity with `@flowpanel/adapter-drizzle`. `@prisma/client` is an optional peer (5.x and 6.x supported). String-id PK coercion to `Int`/`BigInt` at the adapter boundary, with a `NaN` guard. Re-exported via `flowpanel/prisma` subpath.

**CLI: `flowpanel eject resource <name>`** — copies a 5-file ownable scaffold under `app/admin/<name>/` (page, new, detail, edit, actions), each stamped with the eject marker `// flowpanel: ejected @ <version> — this file is yours`. ts-morph removes the matching `resource(...)` call from `flowpanel.config.ts` and appends an `// ejected: app/admin/<name>` marker comment. `doctor` exposes `checkEjectMarker` to verify. Recognises drizzle, prisma, and bare-identifier resource shapes.

**Runtime DX: `theme.components`** — `<ComponentsProvider>` + `useComponents()` make the slot registry real. `EmptyState` and `MetricCard` are overridable from `theme.components`. `DefaultEmptyState` and `DefaultMetricCard` are now public so user wrappers can compose without recursion. The `@flowpanel/next` bridge forwards `config.theme.components` automatically.

**Runtime DX: `labels`** — typed `LabelsConfig` (structured, not flat `Record<string,string>`) + `mergeLabels(user)` (returns `DEFAULT_LABELS` singleton when input is empty/undefined). Wired through `<LabelsProvider>` + `useLabels()`. Three internal consumers exercise the registry: BulkBar `${n} selected`, DataTable empty state, ReferencePicker empty fallback.

**Polish — motion**: skeleton shimmer (replaces Tailwind animate-pulse), scale-in for popover/dropdown/alert-dialog content, slide-up for BulkBar; all `prefers-reduced-motion`-aware via `animation: none` cancellation.

**Polish — a11y**: drawer accessible-name regression test guarding the Radix Dialog wrapper, `FormError` declares `aria-live="assertive"` explicitly. Axe Playwright smoke (`/admin`, `/admin/users`, `/admin/monitoring` — wcag2a+wcag2aa) and keyboard-only smoke (skip-link tab + Esc closes drawer) added to `@flowpanel/e2e`.

**Showcase (freelance-radar)**: demos `theme.components.MetricCard` via `PriorityMetricCard` (rings the default body) + Russian `labels` for 6 chrome groups (actions, bulkBar, pagination, noResults, confirm).

**Breaking changes from `0.3.0-alpha.1`**: none of the existing public API is removed; M4a is additive. The major bump signals API surface stabilization for 1.0.
