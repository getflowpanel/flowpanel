import type { ResolvedLabels } from "../types/labels";

/** Navigation, lists, filters and record chrome: the first half of a language preset. */
export type ChromeLabels = Pick<
  ResolvedLabels,
  | "navigation"
  | "table"
  | "dateRange"
  | "savedViews"
  | "pagination"
  | "filters"
  | "bulkBar"
  | "actions"
  | "drawer"
  | "detail"
  | "related"
>;

/** Forms, walls, widgets and messages: the second half of a language preset. */
export type MessageLabels = Omit<ResolvedLabels, keyof ChromeLabels>;
