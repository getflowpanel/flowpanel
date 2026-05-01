// Client-only entry. All exports are bundled into dist/client.js with a
// top-level "use client" directive (see tsup.config.ts). The server-side
// `DashboardPage` imports these via `@flowpanel/next/client`.
export { CommandHost, type CommandHostProps } from "./command/CommandHost.js";
export { DataTableWithDrawerRows } from "./drawer/DataTableWithDrawerRows.js";
export { DrawerHost } from "./drawer/DrawerHost.js";
export { DashboardDateRange } from "./pages/dashboard-date-range.js";
export { WidgetErrorBoundary } from "./runtime/WidgetErrorBoundary.js";
