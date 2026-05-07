# @flowpanel/cli

## 0.2.5-alpha.0

### Patch Changes

- M2.5 backfill closing spec §2.1 / §19 gaps before M3 realtime lands.

  **Core + adapter**

  - `FlowpanelTypes` augmentation interface + `InferDB` helper: bind adapter's `db` type into every `WidgetContext` without per-callsite generics (spec §21).
  - `Adapter<DB>` + `WidgetContext<DB>` generic.
  - Soft-delete support in Drizzle: `delete.softDelete` column auto-filters list, UPDATE on delete, new `adapter.restore()`.
  - `toCsv` / `toJson` row serializers (RFC 4180) reused by adapter export.
  - `defineAdmin` auto-injects `BulkAction { key: "delete" }` when delete enabled and `bulkActions` undefined.

  **Next runtime**

  - `FilterBar` server-to-client pipeline; 7 filter primitives (text/select/multi/daterange/numeric/boolean/tag) wired via `useAdminTable` URL-sync hook.
  - DataTable: row selection + column-visibility + density toggle + bulk bar; `columnVisibility` prop.
  - `applyActionResult` helper: publish + revalidate; respects `refresh === false`.
  - `publish()` + `publishResource()` (memory driver; Redis driver in M3).
  - Auto-publish `resource.<name>` on built-in create/update/delete.
  - Drawer: real action executor (replaces 501 stub) with ActionContext; `triggerDownload` client utility; widget tabs render server-resolved payloads (metric, table, stat-group, chart descriptor, custom fallback).

  **React primitives**

  - 5 feedback: Toast + ToastProvider + useToast (sonner), ConfirmDialog (Radix AlertDialog), SkeletonTable, HealthBanner, ErrorState.
  - 5 data-input: ReferencePicker (cmdk+Popover async FK), TagInput, JsonEditor, FormSection, AsyncSelect.
  - 5 atoms: TimeAgo, StatusBadge, CopyButton, Sparkline, Avatar.
  - Shell: Breadcrumbs, DetailShell, SectionLabel, Divider; PageHeader.breadcrumbs prop.
  - Field dispatches `type=json|tags|textarea` to new primitives.

- Updated dependencies
  - @flowpanel/core@0.2.5-alpha.0
