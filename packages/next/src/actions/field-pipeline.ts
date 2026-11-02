import type {
  FieldAccessMap,
  FieldDef,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { assertWritableInput, runWithRequestContext } from "@flowpanel/core";
import { declaredWriteFields, writeTarget } from "@flowpanel/core/internal";
import type { z } from "zod";
import { columnDefs } from "../runtime/column-defs";
import { declaredFormFields, fieldFlag } from "../runtime/resolve-form-fields";

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
export function formOffersField(
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
      const resolve = f.defaultValue;
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

/** The create fields judged on the starting values; for an API write, `readOnly` also on `input` over them and `hidden` only so. */
export async function createFormFields(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
  input?: unknown,
): Promise<FieldDef<Record<string, unknown>>[] | undefined> {
  const fields = declaredFormFields(resource, "create");
  const judged = (f: FieldDef<Record<string, unknown>>) =>
    typeof f.hidden === "function" || typeof f.readOnly === "function";
  if (!fields?.some(judged)) return fields;
  const starting = await startingValues(config, resource, fields, {}, reqCtx);
  const given = typeof input === "object" && input !== null && !Array.isArray(input) ? input : null;
  const merged = given
    ? await startingValues(config, resource, fields, { ...given }, reqCtx)
    : starting;
  return fields.map((f) =>
    judged(f)
      ? {
          ...f,
          hidden: fieldFlag(f.hidden, merged),
          readOnly: fieldFlag(f.readOnly, starting) || fieldFlag(f.readOnly, merged),
        }
      : f,
  );
}

/** `input` over the field and resource defaults, then the columns' database defaults. */
async function startingValues(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  fields: FieldDef<Record<string, unknown>>[],
  input: Record<string, unknown>,
  reqCtx: RequestContext,
): Promise<Record<string, unknown>> {
  const values = await applyFieldDefaults(resource, fields, input, reqCtx);
  for (const column of config.adapter.introspect(writeTarget(resource)).columns) {
    if (values[column.name] === undefined && column.defaultValue !== undefined) {
      values[column.name] = column.defaultValue;
    }
  }
  return values;
}

/** The update's fields plus `extra` columns the form does not list, such as an inline-editable one. */
export function updateFields(
  resource: ResourceConfig,
  extra: readonly string[],
): FieldDef<Record<string, unknown>>[] | undefined {
  const fields = declaredFormFields(resource, "update");
  if (!fields) return fields;
  const missing = extra.filter((name) => !fields.some((f) => f.name === name));
  return [...fields, ...missing.map((name) => ({ name }))];
}

/** Columns the list edits in place: a script may write them wherever the list can. */
export function editableColumns(resource: ResourceConfig): string[] {
  return columnDefs(resource).flatMap((column) =>
    column.editable === true && column.field ? [column.field] : [],
  );
}
