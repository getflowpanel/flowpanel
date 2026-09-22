# @flowpanel/react

UI primitives for FlowPanel — shadcn-style components built on Radix UI + Tailwind v4 + design tokens.

[![npm](https://img.shields.io/npm/v/@flowpanel/react.svg)](https://www.npmjs.com/package/@flowpanel/react)

> Most users import from **`@flowpanel/kit/react`** (umbrella subpath). Depend on `@flowpanel/react` directly only when building your own FlowPanel-shaped UI library.

## Components

- **Shell:** `AdminShell`, `AdminNav`, `PageHeader`, `Drawer`, `CommandPalette`, `Breadcrumbs`.
- **Data:** `DataTable` (sort, filter, pagination, selection, column resize, column pin, realtime, soft-delete), `FilterBar`, `BulkBar`, `Pagination`, `JsonEditor`, `ReferencePicker`.
- **Widgets:** `MetricCard`, `StatGroupCard`, `TableWidget`, `CustomWidget`.
- **Forms:** `Form`, `AutoForm`, `FormField`, `FormError`, `FormSubmit`.
- **Atoms:** `Avatar`, `Badge`, `StatusBadge`, `Sparkline`, `LiveIndicator`, `TimeAgo`, `Mono`.
- **Feedback:** `EmptyState`, `ErrorState`, `HealthBanner`, `ConfirmDialog`, `SkeletonTable`, `Toast`.
- **Hooks:** `useAdminTable`, `useAdminDrawer`, `useAdminCommand`, `useLiveChannel`, `useUrlState`.
- **Realtime:** `RealtimeProvider`, `useRealtimeBus`, `useRealtimeRefresh`, `useRealtimeStats`, `useRealtimeStatus`, `useOptimisticAction`.
- **Theming:** `ComponentsProvider` + `useComponents` (10 overridable slots), `LabelsProvider` + `useLabels` (i18n).

## Styles

For the default setup, import the precompiled stylesheet from `@flowpanel/kit` in
the FlowPanel admin layout:

```ts
import "@flowpanel/kit/styles/admin.css";
```

It is isolated to FlowPanel roots and portals and does not require Tailwind. The
raw `@flowpanel/react/styles/admin.css` export is a legacy opt-in source stylesheet
for applications that intentionally compile it with their own Tailwind pipeline.

## Documentation

<https://flowpanel.tech>

## License

MIT
