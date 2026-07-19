export type DrizzleDialect = "pg" | "mysql" | "sqlite";

const ENTITY_KIND = Symbol.for("drizzle:entityKind");

const TABLE_KIND: Record<string, DrizzleDialect> = {
  PgTable: "pg",
  MySqlTable: "mysql",
  SQLiteTable: "sqlite",
};

function dialectOfTable(value: unknown): DrizzleDialect | undefined {
  const ctor = (value as { constructor?: Record<symbol, unknown> } | null | undefined)?.constructor;
  const kind = ctor?.[ENTITY_KIND];
  return typeof kind === "string" ? TABLE_KIND[kind] : undefined;
}

export function resolveDialect(opts: {
  schema: Record<string, unknown>;
  dialect?: DrizzleDialect;
}): DrizzleDialect {
  if (opts.dialect) return opts.dialect;
  for (const value of Object.values(opts.schema)) {
    const inferred = dialectOfTable(value);
    if (inferred) return inferred;
  }
  throw new Error(
    "drizzleAdapter: could not infer the SQL dialect — `schema` holds no drizzle table. " +
      'Pass `schema` as the namespace of your table definitions (import * as schema from "./schema"), ' +
      'or set the dialect explicitly: drizzleAdapter({ db, schema, dialect: "pg" | "mysql" | "sqlite" }).',
  );
}
