// Client-only entry. All exports are bundled into dist/client.js with a
// top-level "use client" directive (see tsup.config.ts). The server-side
// `DashboardPage` imports these via `@flowpanel/next/client`.
export {
  DashboardActionsBar,
  type DashboardActionsBarProps,
} from "./actions/DashboardActionsBar.js";
export { CommandHost, type CommandHostProps } from "./command/CommandHost.js";
export { DataTableWithDrawerRows } from "./drawer/DataTableWithDrawerRows.js";
export { DrawerHost } from "./drawer/DrawerHost.js";
export { DetailTabsClient, type DetailTabsClientProps } from "./pages/DetailTabsClient.js";
export { DashboardDateRange } from "./pages/dashboard-date-range.js";
export {
  ResourceListFilters,
  type ResourceListFiltersProps,
} from "./pages/resource-list-filters.js";
export {
  ResourceListSearch,
  type ResourceListSearchProps,
} from "./pages/resource-list-search.js";
export {
  type SavedView,
  SavedViewsDropdown,
  type SavedViewsDropdownProps,
} from "./pages/SavedViewsDropdown.js";
export { WidgetErrorBoundary } from "./runtime/WidgetErrorBoundary.js";
