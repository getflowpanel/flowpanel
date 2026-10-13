import type {
  FieldAccessMap,
  FieldDef,
  QueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import { assertWritableInput, formatLabel, humanize, runWithRequestContext } from "@flowpanel/core";
import { declaredWriteFields, writeTarget } from "@flowpanel/core/internal";
import type { z } from "zod";
import { fieldFlag } from "../runtime/resolve-form-fields";
import { choiceErrors } from "./field-choices";

export { declaredWriteFields };

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
      const inferred = config.adapter.inferSchema(writeTarget(resource));
      return {
        create: userSchema.create ?? inferred.create,
        update: userSchema.update ?? inferred.update,
      };
    }
    return { create: userSchema, update: userSchema };
  }
  const inferred = config.adapter.inferSchema(writeTarget(resource));
  return { create: inferred.create, update: inferred.update };
}

/** The schema narrowed to one column, so an inline edit is not failed by the columns it leaves alone. */
export function pickSchema(
  schema: z.ZodTypeAny | undefined,
  field: string,
): z.ZodTypeAny | undefined {
  const pick = (schema as { pick?: (mask: Record<string, true>) => z.ZodTypeAny } | undefined)
    ?.pick;
  return typeof pick === "function" ? pick.call(schema, { [field]: true }) : schema;
}

/** The generated form may only offer columns a write is allowed to carry. */
export function writableColumns<Column extends { name: string; primaryKey?: boolean }>(
  resource: ResourceConfig,
  columns: Array<
    Column & { generated?: boolean; writableOnCreate?: boolean; writableOnUpdate?: boolean }
  >,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  mode?: "update",
): Column[] {
  if (fields) return columns;
  const writable = new Set(declaredWriteFields(resource, undefined));
  if (mode !== "update") return columns.filter((c) => writable.has(c.name));
  return columns.filter(
    (c) => writable.has(c.name) && !c.primaryKey && !c.generated && c.writableOnUpdate !== false,
  );
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
    if (fieldFlag(field.readOnly, current ?? {})) {
      policies[field.name] = { ...policies[field.name], write: false };
    }
  }
  return policies;
}

/** Whether the generated form shows this field as an editable control to this caller. */
function formOffersField(
  field: FieldDef<Record<string, unknown>>,
  shown: Record<string, unknown>,
  denied: ReadonlySet<string>,
): boolean {
  return (
    !denied.has(field.name) && !fieldFlag(field.hidden, shown) && !fieldFlag(field.readOnly, shown)
  );
}

/** A posted form also carries read-only and unrendered fields for display; only editable ones are input. */
export function formInput(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
  current: Record<string, unknown> | null,
  denied: ReadonlySet<string>,
): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const out: Record<string, unknown> = { ...input };
  for (const name of denied) delete out[name];
  for (const field of fields ?? []) {
    if (!formOffersField(field, current ?? {}, denied)) delete out[field.name];
  }
  return out;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

/**
 * `required` fields the form showed as editable that this write leaves empty.
 * On update (`current` set) only submitted keys count, so an untouched field keeps its stored value.
 */
export function missingRequiredErrors(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  values: Record<string, unknown>,
  current: Record<string, unknown> | null,
  labels: ResolvedLabels,
  denied: ReadonlySet<string>,
): Record<string, string> {
  const shown = current ?? {};
  const out: Record<string, string> = {};
  for (const field of fields ?? []) {
    if (field.required !== true) continue;
    if (current !== null && !Object.hasOwn(values, field.name)) continue;
    if (!isEmptyValue(values[field.name])) continue;
    if (!formOffersField(field, shown, denied)) continue;
    out[field.name] = formatLabel(labels.form.required, {
      label: field.label ?? humanize(field.name),
    });
  }
  return out;
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
  resource: ResourceConfig,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: Record<string, unknown>,
  reqCtx: RequestContext,
): Promise<Record<string, unknown>> {
  const out = { ...input };
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

/** Per-field validators, then the choices and references the form offered this caller. */
export async function fieldRuleErrors(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  values: Record<string, unknown>,
  current: Record<string, unknown> | null,
  reqCtx: RequestContext,
  labels: ResolvedLabels,
): Promise<Record<string, string> | null> {
  const errors = {
    ...(await runFieldValidators(fields, values)),
    ...(await choiceErrors(config, resource, fields, values, current, reqCtx, labels)),
  };
  return Object.keys(errors).length > 0 ? errors : null;
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

/** A missing value, as the schema reports one — never an author's own message. */
function isMissingValueIssue(issue: z.core.$ZodIssue): boolean {
  if (issue.code === "invalid_type" || issue.code === "invalid_value") return true;
  // Zod's own ">=1 characters" wording; an authored `.min(1, "…")` passes through.
  return issue.code === "too_small" && issue.minimum === 1 && issue.message.startsWith("Too small");
}

// Zod's own wording only; an authored `z.number({ message })` passes through.
function isNotANumberIssue(issue: z.core.$ZodIssue): boolean {
  return (
    issue.code === "invalid_type" &&
    issue.expected === "number" &&
    issue.message.startsWith("Invalid input")
  );
}

/**
 * Turns a schema rejection into per-field messages: a missing required value reads as `labels.form.required`,
 * a value that is not a number as `labels.form.invalidNumber`. Every other issue keeps the message it came with.
 */
export function friendlyFieldErrors(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
  err: z.ZodError,
  labels: ResolvedLabels,
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
    const label = field?.label ?? humanize(field?.name ?? key);
    out[key] =
      isEmpty && isMissingValueIssue(issue)
        ? formatLabel(labels.form.required, { label })
        : isNotANumberIssue(issue)
          ? formatLabel(labels.form.invalidNumber, { label })
          : issue.message;
  }
  return out;
}
