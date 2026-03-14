export type TimeInterval = `${number}${"s" | "m" | "h"}`;

export interface Session {
  userId: string;
  role: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AiCostStageConfig {
  costField: string;
  tokensIn: string;
  tokensOut: string;
  model: string;
}

export interface RunLogColumn {
  field: string;
  label: string;
  width?: number;
  flex?: number;
  mono?: boolean;
  format?: "number" | "currency-usd" | "currency-usd-micro" | "duration" | "date-relative" | "date";
  render?: "stagePill" | "statusTag" | string;
}

export interface DrawerSectionConfig {
  type: "trend-chart" | "stat-grid" | "breakdown" | "error-list" | "kv-grid" | "error-block";
  field?: string;
  groupBy?: string;
  stats?: string[];
  fields?: string[];
  limit?: number;
  when?: (run: Record<string, unknown>) => boolean;
}

export interface DrawerActionConfig {
  label: string;
  onClick: string;
  variant?: "default" | "danger";
  when?: (run: Record<string, unknown>) => boolean;
}

export type SqlExecutorFactory = import("./db.js").SqlExecutorFactory;
