import { fieldNameToColumn } from "./schemaGenerator";

export interface QueryDef {
  type: string;
  sql: string;
  params: unknown[];
  where?: Record<string, unknown>;
  limit?: number;
}

interface QueryBuilderOptions {
  stages: readonly string[];
  stageFields: Record<string, Record<string, unknown>>;
  fields: Record<string, unknown>;
}

const RESERVED_COLUMNS: Record<string, string> = {
  durationMs: "duration_ms",
  startedAt: "started_at",
  finishedAt: "finished_at",
  errorClass: "error_class",
  errorMessage: "error_message",
  userId: "user_id",
  partitionKey: "partition_key",
};

function resolveColumns(
  fieldName: string,
  stageFilter: string | undefined,
  stageFields: Record<string, Record<string, unknown>>,
): string[] {
  if (fieldName in RESERVED_COLUMNS) {
    return [RESERVED_COLUMNS[fieldName] ?? fieldName];
  }

  const col = fieldNameToColumn(fieldName);

  if (stageFilter) {
    return [`${stageFilter}_${col}`];
  }

  const cols: string[] = [];
  for (const [stage, fields] of Object.entries(stageFields)) {
    if (fieldName in fields) {
      cols.push(`${stage}_${col}`);
    }
  }
  return cols;
}

class QueryBuilderInstance {
  private _where: {
    stage?: string;
    status?: string;
    partitionKey?: string;
    timeRange?: string;
  } = {};

  constructor(private opts: QueryBuilderOptions) {}

  where(filter: {
    stage?: string;
    status?: string;
    partitionKey?: string;
    timeRange?: string;
  }): QueryBuilderInstance {
    const next = new QueryBuilderInstance(this.opts);
    next._where = { ...this._where, ...filter };
    return next;
  }

  private stageFilter(): string | undefined {
    return this._where.stage;
  }

  private timeRangeToCutoff(range: string): string {
    const units: Record<string, number> = { h: 3600000, d: 86400000 };
    const match = range.match(/^(\d+)([hd])$/);
    if (!match) return new Date(0).toISOString();
    const ms = Number(match[1]) * (units[match[2] ?? "h"] ?? 3600000);
    return new Date(Date.now() - ms).toISOString();
  }

  private whereClause(): [string, unknown[]] {
    const parts: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (this._where.stage) {
      parts.push(`stage = $${idx++}`);
      params.push(this._where.stage);
    }
    if (this._where.status) {
      parts.push(`status = $${idx++}`);
      params.push(this._where.status);
    }
    if (this._where.partitionKey) {
      parts.push(`partition_key = $${idx++}`);
      params.push(this._where.partitionKey);
    }
    if (this._where.timeRange) {
      parts.push(`started_at >= $${idx++}`);
      params.push(this.timeRangeToCutoff(this._where.timeRange));
    }

    return [parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "", params];
  }

  count(): QueryDef {
    const [where, params] = this.whereClause();
    return {
      type: "count",
      sql: `SELECT COUNT(*) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
      where: this._where,
    };
  }

  successRate(): QueryDef {
    const [where, params] = this.whereClause();
    return {
      type: "successRate",
      sql: `SELECT ROUND(100.0 * SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0), 2) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
      where: this._where,
    };
  }

  sum(fieldName: string): QueryDef {
    const cols = resolveColumns(fieldName, this.stageFilter(), this.opts.stageFields);
    if (cols.length === 0) {
      throw new Error(
        `sum("${fieldName}"): field not found in any stage. Check your stageFields config.`,
      );
    }
    const expr = cols.map((c) => `COALESCE(${c}, 0)`).join(" + ");
    const [where, params] = this.whereClause();
    return {
      type: "sum",
      sql: `SELECT SUM(${expr}) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
      where: this._where,
    };
  }

  avg(fieldName: string): QueryDef {
    const col = RESERVED_COLUMNS[fieldName] ?? fieldNameToColumn(fieldName);
    const [where, params] = this.whereClause();
    return {
      type: "avg",
      sql: `SELECT AVG(${col}) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
      where: this._where,
    };
  }

  p95(fieldName: string): QueryDef {
    const col = RESERVED_COLUMNS[fieldName] ?? fieldNameToColumn(fieldName);
    const [where, params] = this.whereClause();
    return {
      type: "p95",
      sql: `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY ${col}) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
      where: this._where,
    };
  }

  hourly(_fieldOrAgg: string): QueryDef {
    const [where, params] = this.whereClause();
    return {
      type: "hourly",
      sql: `SELECT date_trunc('hour', started_at) AS bucket, COUNT(*) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""} GROUP BY bucket ORDER BY bucket`,
      params,
      where: this._where,
    };
  }

  byStage(): QueryDef {
    const [where, params] = this.whereClause();
    return {
      type: "byStage",
      sql: `SELECT stage, COUNT(*) AS count, SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) AS succeeded, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed FROM flowpanel_pipeline_run${where ? ` ${where}` : ""} GROUP BY stage`,
      params,
      where: this._where,
    };
  }

  topErrors(limit = 5): QueryDef {
    const [where, params] = this.whereClause();
    const statusFilter = where
      ? ` AND status = 'failed' AND error_class IS NOT NULL`
      : ` WHERE status = 'failed' AND error_class IS NOT NULL`;
    const limitIdx = params.length + 1;
    return {
      type: "topErrors",
      sql: `SELECT error_class, COUNT(*) AS count FROM flowpanel_pipeline_run ${where}${statusFilter} GROUP BY error_class ORDER BY count DESC LIMIT $${limitIdx}`,
      params: [...params, limit],
      where: this._where,
      limit,
    };
  }

  chartBuckets(timeRange: string, dialect: "postgres" | "sqlite"): QueryDef {
    // Ensure time range is applied
    if (!this._where.timeRange) {
      this._where = { ...this._where, timeRange };
    }
    const [where, params] = this.whereClause();

    let bucketExpr: string;

    if (dialect === "sqlite") {
      bucketExpr = `strftime('%Y-%m-%dT%H:00:00', started_at)`;
    } else {
      switch (timeRange) {
        case "1h":
          bucketExpr = `date_trunc('hour', started_at) + floor(extract(minute from started_at) / 5) * interval '5 minutes'`;
          break;
        case "6h":
          bucketExpr = `date_trunc('hour', started_at) + floor(extract(minute from started_at) / 30) * interval '30 minutes'`;
          break;
        case "24h":
          bucketExpr = `date_trunc('hour', started_at)`;
          break;
        case "7d":
          bucketExpr = `date_trunc('hour', started_at) + floor(extract(hour from started_at) / 6) * interval '6 hours'`;
          break;
        case "30d":
          bucketExpr = `date_trunc('day', started_at)`;
          break;
        default:
          bucketExpr = `date_trunc('hour', started_at)`;
      }
    }

    return {
      type: "chartBuckets",
      sql: `SELECT ${bucketExpr} AS bucket, COUNT(*) AS total, SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) AS succeeded, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed FROM flowpanel_pipeline_run${where ? ` ${where}` : ""} GROUP BY bucket ORDER BY bucket`,
      params,
      where: this._where,
    };
  }

  aiCostPerUserPerPeriod(): QueryDef {
    return {
      type: "aiCostPerUserPerPeriod",
      sql: `SELECT u.id, u.email, COALESCE(usage.cost_usd, 0) AS value FROM users u LEFT JOIN LATERAL (SELECT SUM(cost_usd)::numeric AS cost_usd FROM flowpanel_ai_usage_daily WHERE partition_key = u.id::text AND day >= u.subscription_period_start AND day < u.subscription_period_end) usage ON true`,
      params: [],
    };
  }
}

export type QueryBuilder = QueryBuilderInstance;

export function createQueryBuilder(opts: QueryBuilderOptions): QueryBuilder {
  return new QueryBuilderInstance(opts);
}
