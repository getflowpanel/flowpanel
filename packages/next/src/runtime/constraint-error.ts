import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import {
  FlowpanelConflictError,
  type FlowpanelError,
  FlowpanelValidationError,
  formatLabel,
  mergeLabels,
} from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { fieldLabels, namedFields } from "./field-labels";
import { declaredFormFields } from "./resolve-form-fields";

type ViolationKind = "unique" | "reference" | "inUse" | "notNull";

interface Violation {
  kind: ViolationKind;
  /** A column name exactly as the database or ORM reported it. */
  column?: string;
  /** An index or constraint name that may contain the column name. */
  hint?: string;
}

interface ErrorLike {
  code?: unknown;
  errno?: unknown;
  message?: unknown;
  detail?: unknown;
  column?: unknown;
  meta?: unknown;
  cause?: unknown;
}

const PG_KEY = /^Key \(([^)]+)\)=/;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function singleColumn(list: string | undefined): string | undefined {
  if (list === undefined || list.includes(",")) return undefined;
  return list.replace(/["`]/g, "").trim();
}

function postgres(err: ErrorLike): Violation | null {
  const detail = text(err.detail);
  const column = singleColumn(PG_KEY.exec(detail)?.[1]);
  const at = column === undefined ? {} : { column };
  if (err.code === "23505") return { kind: "unique", ...at };
  if (err.code === "23503") {
    return /still referenced/.test(detail) ? { kind: "inUse" } : { kind: "reference", ...at };
  }
  if (err.code === "23502") {
    return typeof err.column === "string" ? { kind: "notNull", column: err.column } : null;
  }
  return null;
}

function mysql(err: ErrorLike): Violation | null {
  const message = text(err.message);
  if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
    const key = /for key '([^']+)'/.exec(message)?.[1];
    return { kind: "unique", ...(key ? { hint: key } : {}) };
  }
  if (err.code === "ER_NO_REFERENCED_ROW_2" || err.errno === 1452) {
    const column = singleColumn(/FOREIGN KEY \(([^)]+)\)/.exec(message)?.[1]);
    return { kind: "reference", ...(column ? { column } : {}) };
  }
  if (err.code === "ER_ROW_IS_REFERENCED_2" || err.errno === 1451) return { kind: "inUse" };
  if (err.code === "ER_BAD_NULL_ERROR" || err.errno === 1048) {
    const column = /Column '([^']+)'/.exec(message)?.[1];
    return { kind: "notNull", ...(column ? { column } : {}) };
  }
  return null;
}

function sqlite(err: ErrorLike): Violation | null {
  const message = text(err.message);
  const unique = /UNIQUE constraint failed: ([\w.]+)(,)?/.exec(message);
  if (unique?.[1]) {
    return unique[2] ? { kind: "unique" } : { kind: "unique", column: lastPart(unique[1]) };
  }
  const notNull = /NOT NULL constraint failed: ([\w.]+)/.exec(message)?.[1];
  if (notNull) return { kind: "notNull", column: lastPart(notNull) };
  if (/FOREIGN KEY constraint failed/.test(message)) return { kind: "reference" };
  return null;
}

function lastPart(qualified: string): string {
  return qualified.slice(qualified.lastIndexOf(".") + 1);
}

function prismaTarget(value: unknown): Pick<Violation, "column" | "hint"> {
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") {
    return { column: value[0] };
  }
  return typeof value === "string" ? { hint: value } : {};
}

function prisma(err: ErrorLike): Violation | null {
  const meta = (typeof err.meta === "object" && err.meta !== null ? err.meta : {}) as Record<
    string,
    unknown
  >;
  if (err.code === "P2002") return { kind: "unique", ...prismaTarget(meta.target) };
  if (err.code === "P2003") {
    return { kind: "reference", ...prismaTarget(meta.field_name ?? meta.constraint) };
  }
  if (err.code === "P2011") return { kind: "notNull", ...prismaTarget(meta.constraint) };
  return null;
}

/** The constraint a write broke, read from the driver or ORM error anywhere along its causes. */
export function constraintViolation(err: unknown): Violation | null {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as ErrorLike;
    const found = postgres(candidate) ?? mysql(candidate) ?? prisma(candidate) ?? sqlite(candidate);
    if (found) return found;
    current = candidate.cause;
  }
  return null;
}

const squash = (name: string) => name.replace(/[_\-\s]/g, "").toLowerCase();

function fieldFor(violation: Violation, fields: readonly string[]): string | undefined {
  const { column, hint } = violation;
  if (column !== undefined) {
    return fields.find((f) => f === column) ?? fields.find((f) => squash(f) === squash(column));
  }
  if (hint === undefined) return undefined;
  const squashed = squash(hint);
  const named = fields
    .filter((f) => squashed.includes(squash(f)))
    .sort((a, b) => squash(b).length - squash(a).length);
  const [longest, next] = named;
  return longest && (!next || squash(next).length < squash(longest).length) ? longest : undefined;
}

/** A write's constraint violation as the error the operator can act on, or `null` for any other failure. */
export function explainConstraint(
  err: unknown,
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  operation: "create" | "update" | "delete",
): FlowpanelError | null {
  const violation = constraintViolation(err);
  if (!violation) return null;
  const labels = mergeLabels(config.labels).form;
  const kind = operation === "delete" && violation.kind === "reference" ? "inUse" : violation.kind;
  if (kind === "inUse") return new FlowpanelConflictError(labels.inUse);
  const columns = config.adapter.introspect(writeTarget(resource)).columns.map((c) => c.name);
  const field = fieldFor(violation, columns);
  const policy = field === undefined ? undefined : resource.options.fieldAccess?.[field];
  if (field === undefined || policy?.read !== undefined || policy?.sensitive === true) {
    if (kind === "notNull") return null;
    return new FlowpanelConflictError(kind === "unique" ? labels.conflict : labels.missingLink);
  }
  const template =
    kind === "unique"
      ? labels.taken
      : kind === "reference"
        ? labels.missingReference
        : labels.required;
  return new FlowpanelValidationError({
    [field]: formatLabel(template, {
      label: fieldLabels(
        resource,
        declaredFormFields(resource, operation === "create" ? "create" : "update"),
        namedFields(config),
      )(field),
    }),
  });
}

/** Runs an adapter write and turns a unique, foreign key or NOT NULL violation into a field error or a 409. */
export async function explainWrite<T>(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  operation: "create" | "update" | "delete",
  write: () => T | PromiseLike<T>,
): Promise<T> {
  try {
    return await write();
  } catch (err) {
    throw explainConstraint(err, config, resource, operation) ?? err;
  }
}
