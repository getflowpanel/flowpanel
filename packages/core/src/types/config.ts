/** Duration string like '10m', '5s', '2h' */
export type TimeInterval = `${number}${"s" | "m" | "h"}`;

/** User session returned by getSession() — identifies the authenticated user */
export interface Session {
  userId: string;
  role: string;
}

/** Absolute date range with start and end */
export interface DateRange {
  start: Date;
  end: Date;
}

/** AI cost tracking configuration for a single stage */
export interface AiCostStageConfig {
  costField: string;
  tokensIn: string;
  tokensOut: string;
  model: string;
}

/** Column definition for the run log table */
export interface RunLogColumn {
  field: string;
  label: string;
  width?: number;
  flex?: number;
  mono?: boolean;
  format?: "number" | "currency-usd" | "currency-usd-micro" | "duration" | "date-relative" | "date";
  render?: "stagePill" | "statusTag" | string;
}

/** Field values accepted by run.set() — keys are camelCase field names */
export type RunFields = Record<string, string | number | boolean | null>;

/** Configuration for a single drawer section */
export interface DrawerSectionConfig {
  type: "trend-chart" | "stat-grid" | "breakdown" | "error-list" | "kv-grid" | "error-block";
  field?: string;
  groupBy?: string;
  stats?: string[];
  fields?: string[];
  limit?: number;
  when?: (run: Record<string, unknown>) => boolean;
}

/** Configuration for a drawer action button */
export interface DrawerActionConfig {
  label: string;
  onClick: string;
  variant?: "default" | "danger";
  when?: (run: Record<string, unknown>) => boolean;
}

export type SqlExecutorFactory = import("./db.js").SqlExecutorFactory;
