---
"@flowpanel/core": minor
"@flowpanel/react": minor
---

`theme.components` now type-checks against `FlowpanelComponentSlots`. Typo'd slot keys (`theme.components.MetricCardd: …`) and mismatched prop shapes both produce compile errors. The interface lives in `@flowpanel/core` as an empty registry and is augmented in `@flowpanel/react` with the 10 shipped slot signatures (Avatar, Badge, Button, ConfirmDialog, EmptyState, MetricCard, PageHeader, Pagination, SkeletonTable, StatusBadge). Per invariant I-11, slot keys are append-only across minors.
