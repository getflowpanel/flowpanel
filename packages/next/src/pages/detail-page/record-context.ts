import type { DetailOptions, ResolvedAdminConfig, ResolvedDateRange } from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import { resolveDateRange } from "../../runtime/date-range";
import { detailTabDateRange } from "../../runtime/widget-context";
import { resolveDashboardDateRangeInput } from "../dashboard";

/** The record page's range: the picked one when `detail.dateRange` is set, else the whole history. */
export function recordRange(
  config: ResolvedAdminConfig,
  detail: DetailOptions<Record<string, unknown>> | undefined,
  searchParams: URLSearchParams,
): ResolvedDateRange {
  if (!detail?.dateRange) return detailTabDateRange();
  const input = resolveDashboardDateRangeInput(detail.dateRange, searchParams);
  return resolveDateRange(input, resolveFormatting(config.formatting).timeZone);
}
