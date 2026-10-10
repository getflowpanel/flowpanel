import type { AnyColumn, SQL, Table } from "drizzle-orm";

export type Row = Record<string, unknown>;

/** The slice of a drizzle database (or transaction) the adapter calls. */
export interface DrizzleLikeDb {
  select: (...args: unknown[]) => {
    from: (ref: Table) => {
      where: (w: SQL | undefined) => unknown;
      orderBy: (o: SQL | AnyColumn) => unknown;
      limit: (n: number) => unknown;
      [k: string]: unknown;
    };
  };
  insert: (ref: Table) => {
    values: (v: Row) => Promise<unknown> & { returning: () => Promise<Row[]> };
  };
  update: (ref: Table) => {
    set: (v: Row) => {
      where: (w: SQL) => Promise<unknown> & { returning: () => Promise<Row[]> };
    };
  };
  delete: (ref: Table) => { where: (w: SQL) => Promise<unknown> };
  transaction: <T>(fn: (tx: DrizzleLikeDb) => Promise<T>) => Promise<T>;
}

export type DrizzleColumnLike = AnyColumn & {
  primary?: boolean;
  notNull?: boolean;
  isUnique?: boolean;
  dataType?: string;
  columnType?: string;
  enumValues?: readonly string[];
};

export type ColumnsRecord = Record<string, DrizzleColumnLike>;

/** A table and the key a write addresses it by. */
export interface WriteTarget {
  ref: Table;
  cols: ColumnsRecord;
  pk: string;
  pkCol: DrizzleColumnLike | undefined;
}

export function pkFor(cols: ColumnsRecord): string {
  const entry = Object.entries(cols).find(([, c]) => c.primary);
  return entry?.[0] ?? "id";
}

/** The first row a select matches, or `undefined`. */
export async function firstRow(query: unknown, where: SQL): Promise<Row | undefined> {
  const rows = (await (query as { where: (w: SQL) => { limit: (n: number) => Promise<unknown[]> } })
    .where(where)
    .limit(1)) as Row[];
  return rows[0];
}

/** Postgres 22P02: the id is not even valid text for the key's type, such as "abc" for a uuid. */
export function isInvalidKeyText(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current = err;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: unknown }).code === "22P02") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
