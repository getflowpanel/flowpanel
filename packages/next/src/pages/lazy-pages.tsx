"use client";
import type { DashboardActionsBarProps } from "../actions/DashboardActionsBar";
import type { RecordActionsBarProps } from "../actions/RecordActionsBar";
import { lazyPart } from "../utils/lazy-part";
import type { AuditLogFiltersProps } from "./audit/AuditLogFilters";
import type { UrlPaginationProps } from "./audit/UrlPagination";
import type { DetailTabsClientProps } from "./DetailTabsClient";
import type { DashboardDateRangeProps } from "./dashboard-date-range";
import type { DashboardFiltersProps } from "./dashboard-filters";

export const DetailTabsClient = lazyPart<DetailTabsClientProps>(() =>
  import("./DetailTabsClient").then((module) => module.DetailTabsClient),
);
export const RecordActionsBar = lazyPart<RecordActionsBarProps>(() =>
  import("../actions/RecordActionsBar").then((module) => module.RecordActionsBar),
);
export const DashboardActionsBar = lazyPart<DashboardActionsBarProps>(() =>
  import("../actions/DashboardActionsBar").then((module) => module.DashboardActionsBar),
);
export const DashboardDateRange = lazyPart<DashboardDateRangeProps>(() =>
  import("./dashboard-date-range").then((module) => module.DashboardDateRange),
);
export const DashboardFilters = lazyPart<DashboardFiltersProps>(() =>
  import("./dashboard-filters").then((module) => module.DashboardFilters),
);
export const AuditLogFilters = lazyPart<AuditLogFiltersProps>(() =>
  import("./audit/AuditLogFilters").then((module) => module.AuditLogFilters),
);
export const UrlPagination = lazyPart<UrlPaginationProps>(() =>
  import("./audit/UrlPagination").then((module) => module.UrlPagination),
);
