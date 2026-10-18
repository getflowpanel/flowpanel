import type {
  ColumnFormat,
  ColumnMeta,
  FieldDef,
  FieldType,
  QueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { accessAllows, humanize, resolveFormatting, runWithRequestContext } from "@flowpanel/core";
import { moneyColumnFactor } from "@flowpanel/core/format";
import type { ResolvedField } from "@flowpanel/react";
import { columnDefs } from "./column-defs";
import { fieldLabels, namedFields } from "./field-labels";
import { moneyInputValue, moneyShape } from "./money-field";
import { readRelatedRows } from "./require-authorized";
import { toWireOptions } from "./select-options";

/** The declared field specs for a form mode, each labelled as the resource labels it everywhere. */
export function declaredFormFields(
  resource: ResourceConfig,
  mode: "create" | "update",
): FieldDef<Record<string, unknown>>[] | undefined {
  const fields =
    mode === "create"
      ? resource.options.create?.fields
      : (resource.options.update?.fields ?? resource.options.create?.fields);
  if (!fields) return undefined;
  const labelOf = fieldLabels(resource, fields);
  return fields.map((field) => (field.label ? field : { ...field, label: labelOf(field.name) }));
}

/** Evaluate a `boolean | (values) => boolean` field option server-side. */
export function fieldFlag(
  flag: boolean | ((values: Partial<Record<string, unknown>>) => boolean) | undefined,
  values: Partial<Record<string, unknown>>,
): boolean {
  return typeof flag === "function" ? flag(values) : (flag ?? false);
}

/** Fields `fieldAccess.write` keeps this caller from writing, judged as the form renders them: before any input. */
export async function deniedFieldWrites(
  resource: ResourceConfig,
  reqCtx: RequestContext,
  current: Record<string, unknown> | null,
): Promise<ReadonlySet<string>> {
  const denied = new Set<string>();
  const context = { ...reqCtx, current, input: {} };
  for (const [name, policy] of Object.entries(resource.options.fieldAccess ?? {})) {
    const write = policy?.write;
    if (write === undefined) continue;
    const allowed =
      typeof write === "function"
        ? Boolean(await write(context))
        : await accessAllows(write, context);
    if (!allowed) denied.add(name);
  }
  return denied;
}

/** Denied fields the caller may not read either: a form leaves them out instead of showing an empty locked control. */
export async function hiddenFormFields(
  resource: ResourceConfig,
  reqCtx: RequestContext,
  denied: ReadonlySet<string>,
): Promise<ReadonlySet<string>> {
  const hidden = new Set<string>();
  const policies = new Map(Object.entries(resource.options.fieldAccess ?? {}));
  for (const name of denied) {
    const policy = policies.get(name);
    const unreadable =
      policy?.sensitive === true ||
      (policy?.read !== undefined && !(await accessAllows(policy.read, reqCtx)));
    if (unreadable) hidden.add(name);
  }
  return hidden;
}

/** Resolve just the CURRENT value's label for a `reference` field — a single PK lookup, not a list. */
async function resolveReferenceCurrentOption(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  ref: { resource: string; labelField: string },
  currentValue: unknown,
): Promise<{ label: string; value: string }[]> {
  if (currentValue === null || currentValue === undefined || currentValue === "") return [];
  const target = config.resourcesByName.get(ref.resource);
  if (!target) return [];
  const pk = config.adapter.introspect(target.ref).primaryKey;
  const rows = await readRelatedRows(config, target, reqCtx, {
    filters: { [pk]: String(currentValue) },
    pageSize: 1,
    extraFields: [pk, ref.labelField],
  });
  const row = rows?.[0];
  if (!row) return [];
  return [{ value: String(row[pk]), label: String(row[ref.labelField] ?? row[pk]) }];
}

/** A create form field's `defaultValue`, a function of the request resolved. */
async function resolvedDefault(
  field: FieldDef<Record<string, unknown>>,
  reqCtx: RequestContext,
  queryCtx: QueryContext,
): Promise<unknown> {
  const value = field.defaultValue;
  if (typeof value !== "function") return value;
  return runWithRequestContext(reqCtx, () => value(queryCtx));
}

export async function resolveFormFields(
  config: ResolvedAdminConfig,
  fields: FieldDef<Record<string, unknown>>[],
  reqCtx: RequestContext,
  row?: Record<string, unknown>,
  denied: ReadonlySet<string> = new Set(),
  hidden: ReadonlySet<string> = new Set(),
  columns: ReadonlyArray<ColumnMeta> = [],
): Promise<ResolvedField[]> {
  const formatting = resolveFormatting(config.formatting);
  const queryCtx: QueryContext = {
    ...reqCtx,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
  };
  const values = row ?? {};
  const visible = fields.filter((f) => !hidden.has(f.name) && !fieldFlag(f.hidden, values));
  const labelOf = fieldLabels(undefined, fields);
  return Promise.all(
    visible.map(async (f): Promise<ResolvedField> => {
      const opts = f.options;
      const defaultValue =
        row === undefined
          ? ((await resolvedDefault(f, reqCtx, queryCtx)) ??
            columns.find((c) => c.name === f.name)?.defaultValue)
          : undefined;
      let options: { label: string; value: string }[] | undefined;
      if (f.reference) {
        options = await resolveReferenceCurrentOption(
          config,
          reqCtx,
          f.reference,
          values[f.name] ?? defaultValue,
        );
      } else if (typeof opts === "function") {
        const resolved = await runWithRequestContext(reqCtx, () => opts(queryCtx));
        options = toWireOptions(resolved);
      } else if (Array.isArray(opts)) {
        options = toWireOptions(opts);
      }
      const shownDefault =
        defaultValue !== undefined && f.type === "money"
          ? moneyInputValue(
              defaultValue,
              moneyShape(
                f,
                columns.find((c) => c.name === f.name),
                formatting,
              ),
              formatting.locale,
            )
          : defaultValue;
      return {
        name: f.name,
        label: labelOf(f.name),
        type: f.type ?? (f.reference ? "reference" : "text"),
        ...(f.help ? { help: f.help } : {}),
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        ...(f.required ? { required: f.required } : {}),
        ...(fieldFlag(f.readOnly, values) || denied.has(f.name) ? { readOnly: true } : {}),
        ...(shownDefault !== undefined ? { defaultValue: shownDefault } : {}),
        ...(f.type === "money" && f.currency ? { currency: f.currency } : {}),
        ...(f.span ? { span: f.span } : {}),
        ...(f.group ? { group: f.group } : {}),
        ...(options ? { options } : {}),
      };
    }),
  );
}

/** The `ColumnDef.reference` and label of each column that declares one. */
export function columnReferences(
  resource: ResourceConfig,
): Map<string, { reference: { resource: string; labelField: string }; label?: string }> {
  const out = new Map<
    string,
    { reference: { resource: string; labelField: string }; label?: string }
  >();
  for (const def of columnDefs(resource)) {
    if (def.field && def.reference) {
      out.set(def.field, { reference: def.reference, ...(def.label ? { label: def.label } : {}) });
    }
  }
  return out;
}

const RECORD_TIMESTAMP = /^(?:created|updated|inserted|modified)(?:_?at|_?on)?$/i;

/** A timestamp the database stamps on the record, such as `created_at default now()`: a generated create form leaves it out. */
export function systemTimestamp(
  column: Pick<ColumnMeta, "name" | "type" | "hasDefault" | "defaultValue">,
): boolean {
  return (
    column.type === "date" &&
    column.hasDefault === true &&
    column.defaultValue === undefined &&
    RECORD_TIMESTAMP.test(column.name)
  );
}

function controlOf(column: ColumnMeta): FieldType {
  if (column.enumValues?.length) return "select";
  if (column.type === "number") return "number";
  if (column.type === "boolean") return "checkbox";
  if (column.type === "date") return "datetime";
  if (column.type === "json") return "json";
  return "text";
}

/** A money column's control: minor units when its format scales the stored amount, as the list shows it. */
function moneyControl(
  format: ColumnFormat | undefined,
): Pick<FieldDef<Record<string, unknown>>, "type" | "storage" | "minorUnits" | "currency"> | null {
  if (typeof format !== "object" || format.kind !== "money") return null;
  const digits = Math.log10(moneyColumnFactor(format));
  const scaled = Number.isInteger(digits) && digits > 0;
  return {
    type: "money",
    storage: scaled ? "minor" : "major",
    ...(scaled ? { minorUnits: digits } : {}),
    ...(format.currency ? { currency: format.currency } : {}),
  };
}

/**
 * The fields of a form no `create.fields` or `update.fields` declares, from its columns: the column's label,
 * its reference picker or money control, and a required mark where the database needs a value the form must send.
 */
export function generatedFormFields(
  resource: ResourceConfig,
  columns: ReadonlyArray<ColumnMeta>,
  mode: "create" | "update",
  named: Readonly<Record<string, string>> = {},
): FieldDef<Record<string, unknown>>[] {
  const defs = new Map(
    columnDefs(resource).flatMap((def) => (def.field ? [[def.field, def]] : [])),
  );
  const references = columnReferences(resource);
  const labelOf = fieldLabels(resource, [], named);
  return columns
    .filter((column) => !column.primaryKey && (mode === "update" || !systemTimestamp(column)))
    .map((column) => {
      const def = defs.get(column.name);
      const reference = references.get(column.name)?.reference;
      const money = reference ? null : moneyControl(def?.format);
      const required =
        column.type !== "boolean" &&
        !column.nullable &&
        !column.generated &&
        (mode === "update" || column.hasDefault !== true);
      return {
        ...(money ?? {}),
        name: column.name,
        label: labelOf(column.name),
        ...(reference ? { reference } : {}),
        ...(money || reference ? {} : { type: controlOf(column) }),
        ...(!reference && column.enumValues?.length
          ? { options: column.enumValues.map((value) => ({ label: humanize(value), value })) }
          : {}),
        ...(required ? { required: true } : {}),
        ...(mode === "create" && column.defaultValue !== undefined
          ? { defaultValue: column.defaultValue }
          : {}),
      };
    });
}

/** The generated form's controls, resolved like declared fields: current reference labels and money amounts included. */
export async function generatedColumnFields(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  columns: ReadonlyArray<ColumnMeta>,
  mode: "create" | "update",
  reqCtx: RequestContext,
  row?: Record<string, unknown>,
): Promise<ResolvedField[]> {
  return resolveFormFields(
    config,
    generatedFormFields(resource, columns, mode, namedFields(config)),
    reqCtx,
    row,
    undefined,
    undefined,
    columns,
  );
}
