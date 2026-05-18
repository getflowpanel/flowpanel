# @flowpanel/react

UI primitives for FlowPanel — shadcn-style components built on Radix UI + Tailwind v4 + design tokens.

[![npm](https://img.shields.io/npm/v/@flowpanel/react.svg)](https://www.npmjs.com/package/@flowpanel/react)

> Most users import from **`flowpanel/react`** (umbrella subpath). Depend on `@flowpanel/react` directly only when building your own FlowPanel-shaped UI library.

## Components

- **Shell:** `AdminShell`, `AdminNav`, `PageHeader`, `Drawer`, `CommandPalette`, `Breadcrumbs`.
- **Data:** `DataTable` (sort, filter, pagination, selection, column resize, column pin, realtime, soft-delete), `FilterBar`, `BulkBar`, `Pagination`, `JsonEditor`, `TagInput`, `ReferencePicker`.
- **Widgets:** `MetricCard`, `StatGroupCard`, `TableWidget`, `CustomWidget`.
- **Forms:** `Form`, `AutoForm`, `FormField`, `FormError`, `FormSubmit`.
- **Atoms:** `Avatar`, `Badge`, `StatusBadge`, `Sparkline`, `LiveIndicator`, `TimeAgo`, `CopyButton`, `Kbd`, `Mono`.
- **Feedback:** `EmptyState`, `ErrorState`, `HealthBanner`, `ConfirmDialog`, `SkeletonTable`, `Toast`.
- **Hooks:** `useAdminTable`, `useAdminDrawer`, `useAdminCommand`, `useLiveChannel`, `useUrlState`.
- **Theming:** `ComponentsProvider` + `useComponents` (10 overridable slots), `LabelsProvider` + `useLabels` (i18n).

## Styles

Import once in your root layout:

```ts
import "@flowpanel/react/styles/admin.css";
```

30 design tokens (color, radius, spacing, motion, type), light + dark, `prefers-reduced-motion` aware, Tailwind v4 `@theme` mapping.

## Documentation

<https://flowpanel.dev>

## License

MIT
