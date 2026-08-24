import type {
  FieldAccessMap,
  FieldDef,
  QueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { assertWritableInput, humanize, runWithRequestContext } from "@flowpanel/core";
import type { z } from "zod";

export interface Schemas {
  create: z.ZodTypeAny;
  update: z.ZodTypeAny;
}

function isSchemaPair(s: unknown): s is { create?: z.ZodTypeAny; update?: z.ZodTypeAny } {
  return typeof s === "object" && s !== null && ("create" in s || "update" in s);
}

export function schemasFor(config: ResolvedAdminConfig, resource: ResourceConfig): Schemas {
  const userSchema = resource.options.schema;
  if (userSchema) {
    if (isSchemaPair(userSchema)) {
      const inferred = config.adapter.inferSchema(resource.ref);
      return {
        create: userSchema.create ?? inferred.create,
        update: userSchema.update ?? inferred.update,
      };
    }
    return { create: userSchema, update: userSchema };
  }
  const inferred = config.adapter.inferSchema(resource.ref);
  return { create: inferred.create, update: inferred.update };
}

function declaredWriteFields(
  resource: ResourceConfig,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
): string[] {
  if (fields) return fields.map((field) => field.name);
  const names: string[] = [];
  for (const column of resource.options.columns ?? []) {
    if (typeof column === "string") names.push(column);
    else if (typeof column === "number" || typeof column === "symbol") names.push(String(column));
    else if (column.field) names.push(column.field);
  }
  return names;
}

function effectiveFieldPolicies(
  resource: ResourceConfig,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  current: Record<string, unknown> | null,
): FieldAccessMap<Record<string, unknown>> {
  const policies: FieldAccessMap<Record<string, unknown>> = {
    ...(resource.options.fieldAccess as FieldAccessMap<Record<string, unknown>> | undefined),
  };
  for (const field of fields ?? []) {
    if (policies[field.name]?.write !== undefined) continue;
    if (field.requireRole !== undefined) {
      const requireRole = field.requireRole;
      policies[field.name] = {
        ...policies[field.name],
        write:
          typeof requireRole === "function" ? ({ session }) => requireRole(session) : requireRole,
      };
      continue;
    }
    const readOnly =
      typeof field.readOnly === "function"
        ? current !== null && field.readOnly(current)
        : field.readOnly === true;
    if (readOnly) policies[field.name] = { ...policies[field.name], write: false };
  }
  return policies;
}

/** Reject undeclared or forbidden submitted fields; never silently strip them. */
export async function assertResourceWritableInput(
  resource: ResourceConfig,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
  current: Record<string, unknown> | null,
  reqCtx: RequestContext,
): Promise<Record<string, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const values = input as Record<string, unknown>;
  return (await assertWritableInput<Record<string, unknown>>({
    declaredFields: declaredWriteFields(resource, fields),
    policies: effectiveFieldPolicies(resource, fields, current),
    input: values,
    context: { ...reqCtx, current, input: values },
  })) as Record<string, unknown>;
}

/** Fill `FieldDef.defaultValue` for keys absent from the input (create only). */
export async function applyFieldDefaults(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
  reqCtx: RequestContext,
): Promise<unknown> {
  if (typeof input !== "object" || input === null) return input;
  const out = { ...(input as Record<string, unknown>) };
  for (const [name, value] of Object.entries(resource.options.create?.defaultValues ?? {})) {
    if (out[name] === undefined) out[name] = value;
  }
  const defaulted = (fields ?? []).filter((f) => f.defaultValue !== undefined);
  for (const f of defaulted) {
    if (out[f.name] !== undefined) continue;
    if (typeof f.defaultValue === "function") {
      const resolve = f.defaultValue as (ctx: QueryContext) => Promise<unknown>;
      out[f.name] = await runWithRequestContext(reqCtx, () =>
        resolve({
          ...reqCtx,
          db: config.adapter.db,
          dateRange: { from: new Date(0), to: new Date() },
          searchParams: new URLSearchParams(),
          signal: new AbortController().signal,
        }),
      );
    } else {
      out[f.name] = f.defaultValue;
    }
  }
  return out;
}

export async function runFieldValidators(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  values: Record<string, unknown>,
): Promise<Record<string, string> | null> {
  if (!fields) return null;
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.validate === undefined) continue;
    const value = values[f.name];
    if (value === undefined) continue;
    if (typeof f.validate === "function") {
      const msg = await f.validate(value, values);
      if (msg) out[f.name] = msg;
    } else {
      const result = f.validate.safeParse(value);
      const first = result.success ? undefined : result.error.issues[0];
      if (first) out[f.name] = first.message;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function friendlyFieldErrors(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
  err: z.ZodError,
): Record<string, string> {
  const fieldByName = new Map((fields ?? []).map((f) => [f.name, f]));
  const values = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".");
    if (!key || key in out) continue;
    const value = values[key];
    const isEmpty = value === undefined || value === null || value === "";
    const field = fieldByName.get(key);
    out[key] =
      isEmpty && field ? `${field.label ?? humanize(field.name)} is required` : issue.message;
  }
  return out;
}
