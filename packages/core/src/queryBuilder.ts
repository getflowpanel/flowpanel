import { fieldNameToColumn } from "./schemaGenerator.js";

export interface QueryDef {
  sql: string;
  params: unknown[];
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
    return [RESERVED_COLUMNS[fieldName]!];
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
  private _where: Record<string, unknown> = {};

  constructor(private opts: QueryBuilderOptions) {}

  where(filter: Record<string, unknown>): QueryBuilderInstance {
    const next = new QueryBuilderInstance(this.opts);
    next._where = { ...this._where, ...filter };
    return next;
  }

  private stageFilter(): string | undefined {
    return this._where.stage as string | undefined;
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
      const tr = this._where.timeRange as { start: Date; end: Date };
      parts.push(`started_at >= $${idx++}`);
      params.push(tr.start);
      parts.push(`started_at < $${idx++}`);
      params.push(tr.end);
    }
    return [parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "", params];
  }

  count(): QueryDef {
    const [where, params] = this.whereClause();
    return {
      sql: `SELECT COUNT(*) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
    };
  }

  successRate(): QueryDef {
    const [where, params] = this.whereClause();
    return {
      sql: `SELECT ROUND(100.0 * SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0), 2) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
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
      sql: `SELECT SUM(${expr}) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
    };
  }

  avg(fieldName: string): QueryDef {
    const col = RESERVED_COLUMNS[fieldName] ?? fieldNameToColumn(fieldName);
    const [where, params] = this.whereClause();
    return {
      sql: `SELECT AVG(${col}) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
    };
  }

  p95(fieldName: string): QueryDef {
    const col = RESERVED_COLUMNS[fieldName] ?? fieldNameToColumn(fieldName);
    const [where, params] = this.whereClause();
    return {
      sql: `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY ${col}) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""}`,
      params,
    };
  }

  hourly(_fieldOrAgg: string): QueryDef {
    const [where, params] = this.whereClause();
    return {
      sql: `SELECT date_trunc('hour', started_at) AS bucket, COUNT(*) AS value FROM flowpanel_pipeline_run${where ? ` ${where}` : ""} GROUP BY bucket ORDER BY bucket`,
      params,
    };
  }

  byStage(): QueryDef {
    const [where, params] = this.whereClause();
    return {
      sql: `SELECT stage, COUNT(*) AS count, SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) AS succeeded, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed FROM flowpanel_pipeline_run${where ? ` ${where}` : ""} GROUP BY stage`,
      params,
    };
  }

  topErrors(limit: number): QueryDef {
    const [where, params] = this.whereClause();
    const whereAndNull = where
      ? `${where} AND error_class IS NOT NULL`
      : `WHERE error_class IS NOT NULL`;
    const limitIdx = params.length + 1;
    return {
      sql: `SELECT error_class, COUNT(*) AS count FROM flowpanel_pipeline_run ${whereAndNull} GROUP BY error_class ORDER BY count DESC LIMIT $${limitIdx}`,
      params: [...params, limit],
    };
  }

  aiCostPerUserPerPeriod(): QueryDef {
    return {
      sql: `SELECT u.id, u.email, COALESCE(usage.cost_usd, 0) AS value FROM users u LEFT JOIN LATERAL (SELECT SUM(cost_usd)::numeric AS cost_usd FROM flowpanel_ai_usage_daily WHERE partition_key = u.id::text AND day >= u.subscription_period_start AND day < u.subscription_period_end) usage ON true`,
      params: [],
    };
  }
}

export type QueryBuilder = QueryBuilderInstance;

export function createQueryBuilder(opts: QueryBuilderOptions): QueryBuilder {
  return new QueryBuilderInstance(opts);
}
