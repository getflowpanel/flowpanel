import { z } from "zod";

export function fieldNameToColumn(name: string): string {
	return name
		.replace(/([A-Z])/g, "_$1")
		.toLowerCase()
		.replace(/^_/, "");
}

export function zodTypeToSql(schema: z.ZodTypeAny): string {
	// Unwrap nullable/optional
	const unwrapped =
		schema instanceof z.ZodNullable || schema instanceof z.ZodOptional
			? (schema as z.ZodNullable<any> | z.ZodOptional<any>).unwrap()
			: schema;

	if (unwrapped instanceof z.ZodString) {
		const checks: Array<{ kind: string; value?: number }> = (unwrapped._def as any).checks ?? [];
		const maxCheck = checks.find((c) => c.kind === "max");
		return maxCheck ? `VARCHAR(${maxCheck.value})` : "TEXT";
	}
	if (unwrapped instanceof z.ZodNumber) {
		const checks: Array<{ kind: string }> = (unwrapped._def as any).checks ?? [];
		const isInt = checks.some((c) => c.kind === "int");
		return isInt ? "INTEGER" : "NUMERIC(12,6)";
	}
	if (unwrapped instanceof z.ZodBoolean) return "BOOLEAN";
	if (unwrapped instanceof z.ZodEnum) {
		const values = (unwrapped as z.ZodEnum<any>).options.map((v: string) => `'${v}'`).join(", ");
		return `TEXT CHECK (value IN (${values}))`;
	}
	if (unwrapped instanceof z.ZodDate) return "TIMESTAMPTZ";
	if (unwrapped instanceof z.ZodObject) return "JSONB";
	return "TEXT";
}

function isNullable(schema: z.ZodTypeAny): boolean {
	return schema instanceof z.ZodNullable || schema instanceof z.ZodOptional;
}

export function generateSchema(config: {
	pipeline: {
		stages: readonly string[];
		fields?: Record<string, z.ZodTypeAny>;
		stageFields?: Record<string, Record<string, z.ZodTypeAny>>;
		indexes?: Array<string[]>;
	};
}): string {
	const { stages, fields = {}, stageFields = {}, indexes = [] } = config.pipeline;
	const stageList = stages.map((s) => `'${s}'`).join(", ");

	// Reserved core columns
	const reservedCols = `  id BIGSERIAL PRIMARY KEY,
  stage TEXT NOT NULL CHECK (stage IN (${stageList})),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  external_id TEXT,
  retry_of_run_id BIGINT REFERENCES flowpanel_pipeline_run(id) ON DELETE SET NULL,
  partition_key TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000) STORED,
  error_class TEXT,
  error_message TEXT,
  error_stack TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  is_historical BOOLEAN NOT NULL DEFAULT false,
  heartbeat_at TIMESTAMPTZ,
  user_id TEXT`;

	// Flat fields (skip userId and partitionKey — already in reserved)
	const flatCols: string[] = [];
	for (const [name, schema] of Object.entries(fields)) {
		if (name === "userId" || name === "partitionKey") continue;
		const col = fieldNameToColumn(name);
		const sqlType = zodTypeToSql(schema);
		const notNull = !isNullable(schema) ? " NOT NULL" : "";
		flatCols.push(`  ${col} ${sqlType}${notNull}`);
	}

	// Stage-specific fields
	const stageCols: string[] = [];
	for (const [stage, stageFieldMap] of Object.entries(stageFields)) {
		for (const [name, schema] of Object.entries(stageFieldMap)) {
			const col = `${stage}_${fieldNameToColumn(name)}`;
			stageCols.push(`  ${col} ${zodTypeToSql(schema)}`); // always nullable
		}
	}

	const allCols = [reservedCols, ...flatCols, ...stageCols].join(",\n");

	const coreIndexes = [
		`CREATE INDEX ON flowpanel_pipeline_run (started_at DESC);`,
		`CREATE INDEX ON flowpanel_pipeline_run (stage, status, started_at DESC);`,
		`CREATE INDEX ON flowpanel_pipeline_run (partition_key, started_at DESC) WHERE partition_key IS NOT NULL;`,
		`CREATE INDEX ON flowpanel_pipeline_run (status, started_at) WHERE status = 'running';`,
		`CREATE INDEX ON flowpanel_pipeline_run (external_id) WHERE external_id IS NOT NULL;`,
		`CREATE INDEX ON flowpanel_pipeline_run (retry_of_run_id) WHERE retry_of_run_id IS NOT NULL;`,
	].join("\n");

	const userIndexes = indexes
		.map(
			(cols) =>
				`CREATE INDEX ON flowpanel_pipeline_run (${cols.map(fieldNameToColumn).join(", ")});`,
		)
		.join("\n");

	const aiUsageTable = `CREATE TABLE IF NOT EXISTS flowpanel_ai_usage_daily (
  day           DATE NOT NULL,
  partition_key TEXT NOT NULL DEFAULT '',
  stage         TEXT NOT NULL,
  model         TEXT NOT NULL,
  tokens_in     BIGINT NOT NULL DEFAULT 0,
  tokens_out    BIGINT NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(12, 6) NOT NULL DEFAULT 0,
  run_count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, partition_key, stage, model)
);
CREATE INDEX IF NOT EXISTS ON flowpanel_ai_usage_daily (day DESC);
CREATE INDEX IF NOT EXISTS ON flowpanel_ai_usage_daily (partition_key, day DESC);`;

	const metaTable = `CREATE TABLE IF NOT EXISTS flowpanel_meta (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);`;

	const auditTable = `CREATE TABLE IF NOT EXISTS flowpanel_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     TEXT NOT NULL,
  user_email  TEXT,
  user_role   TEXT NOT NULL,
  ip_address  INET,
  user_agent  TEXT,
  action      TEXT NOT NULL,
  target_kind TEXT,
  target_ids  TEXT[],
  result      TEXT NOT NULL CHECK (result IN ('success', 'denied', 'error')),
  details     JSONB,
  request_id  TEXT
);
CREATE INDEX IF NOT EXISTS ON flowpanel_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS ON flowpanel_audit_log (user_id, at DESC);`;

	const migrationsTable = `CREATE TABLE IF NOT EXISTS flowpanel_migrations (
  id          TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum    TEXT NOT NULL,
  duration_ms INTEGER NOT NULL
);`;

	return [
		`CREATE TABLE IF NOT EXISTS flowpanel_pipeline_run (\n${allCols}\n);`,
		coreIndexes,
		userIndexes,
		aiUsageTable,
		metaTable,
		auditTable,
		migrationsTable,
	]
		.filter(Boolean)
		.join("\n\n");
}
