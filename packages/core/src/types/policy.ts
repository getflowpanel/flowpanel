import type { Scope, Session } from "./session.js";

export interface AccessContext {
  session: Session | null;
  role: string;
  scope: Scope;
}

export type AccessRule =
  | boolean
  | string
  | readonly string[]
  | ((context: AccessContext) => boolean | Promise<boolean>);

export type ResourceOperation = "read" | "create" | "update" | "delete";

export interface ResourceAccess<Row = unknown> {
  read?: AccessRule;
  create?: AccessRule;
  update?: AccessRule;
  delete?: AccessRule;
  /** Keeps the row type attached when policies are composed generically. */
  readonly __row?: Row;
}

export interface FieldWriteContext<Row> extends AccessContext {
  current: Row | null;
  input: Partial<Row>;
}

export interface FieldAccess<Row> {
  read?: AccessRule;
  write?:
    | boolean
    | string
    | readonly string[]
    | ((context: FieldWriteContext<Row>) => boolean | Promise<boolean>);
  /** Sensitive fields are write-only and are redacted from errors and audit diffs. */
  sensitive?: boolean;
}

export type FieldAccessMap<Row> = Partial<{
  [Field in keyof Row & string]: FieldAccess<Row>;
}>;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type UiCondition<Row> =
  | { field: keyof Row & string; eq: JsonValue }
  | { field: keyof Row & string; neq: JsonValue }
  | { field: keyof Row & string; in: JsonValue[] }
  | { all: UiCondition<Row>[] }
  | { any: UiCondition<Row>[] }
  | { not: UiCondition<Row> };
