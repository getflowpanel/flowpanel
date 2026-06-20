import type {
  FieldDef,
  QueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { FlowpanelAccessError, humanize, runWithRequestContext } from "@flowpanel/core";
import type { z } from "zod";
import { roleAllows } from "../runtime/action-helpers.js";

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

export interface StrippedField {
  name: string;
  reason: "role" | "readOnly";
}

export function stripNonWritableFields(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
  reqCtx: RequestContext,
): { safe: unknown; stripped: StrippedField[] } {
  if (!fields || typeof input !== "object" || input === null) {
    return { safe: input, stripped: [] };
  }
  const values = input as Record<string, unknown>;
  const stripped: StrippedField[] = [];
  for (const f of fields) {
    if (!roleAllows(f.requireRole, reqCtx)) stripped.push({ name: f.name, reason: "role" });
    else if (typeof f.readOnly === "function" ? f.readOnly(values) : f.readOnly === true)
      stripped.push({ name: f.name, reason: "readOnly" });
  }
  if (stripped.length === 0) return { safe: input, stripped };
  const out = { ...values };
  for (const f of stripped) delete out[f.name];
  return { safe: out, stripped };
}

export function throwIfStrippedRequired(
  stripped: StrippedField[],
  fieldErrors: Record<string, string>,
): void {
  const hit = stripped.find(({ name }) =>
    Object.keys(fieldErrors).some((k) => k === name || k.startsWith(`${name}.`)),
  );
  if (!hit) return;
  throw new FlowpanelAccessError(
    hit.reason === "role"
      ? `Field "${hit.name}" is required but restricted to another role.`
      : `Field "${hit.name}" is required but read-only.`,
  );
}

/** Fill `FieldDef.defaultValue` for keys absent from the input (create only). */
export async function applyFieldDefaults(
  config: ResolvedAdminConfig,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
  reqCtx: RequestContext,
): Promise<unknown> {
  if (!fields || typeof input !== "object" || input === null) return input;
  const defaulted = fields.filter((f) => f.defaultValue !== undefined);
  if (defaulted.length === 0) return input;
  const out = { ...(input as Record<string, unknown>) };
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
