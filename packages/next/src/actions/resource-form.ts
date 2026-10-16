import type {
  FieldDef,
  ResolvedAdminConfig,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import {
  FlowpanelError,
  FlowpanelValidationError,
  formatLabel,
  mergeLabels,
  resolveFormatting,
} from "@flowpanel/core";
import { moneyDecimals, parseMoney } from "@flowpanel/core/format";
import { writeTarget } from "@flowpanel/core/internal";
import { actionFailure } from "../runtime/action-failure";
import { coerceRowByColumns } from "../runtime/coerce-values";
import { fieldLabels } from "../runtime/field-labels";
import { moneyExample, moneyShape } from "../runtime/money-field";
import {
  type RequestBodyError,
  readRequestFormData,
  requestBodyErrorResponse,
} from "../runtime/request-body";
import { declaredFormFields, generatedFormFields } from "../runtime/resolve-form-fields";
import { rowKeyOf } from "../runtime/row-identity";
import { guardedRoute, lookupResource } from "../runtime/write-pipeline";
import { declaredWriteFields } from "./field-pipeline";
import { type FormFieldShape, readFormValues } from "./form-values";
import { type FormActionResult, makeActions } from "./resource-actions";

/** The fields this form declares, or the ones it generates from the columns it may write. */
function formFieldDefs(
  resource: ResourceConfig,
  config: ResolvedAdminConfig,
  mode: "create" | "update",
): FieldDef<Record<string, unknown>>[] {
  const declared = declaredFormFields(resource, mode);
  if (declared) return declared;
  const writable = new Set(declaredWriteFields(resource, undefined));
  const { columns } = config.adapter.introspect(writeTarget(resource));
  return generatedFormFields(
    resource,
    columns.filter((column) => writable.has(column.name)),
    mode,
  );
}

/**
 * The controls this form renders, as the shapes `readFormValues` decodes.
 * A field the server may withhold is left out, since only a rendered control makes "nothing" mean false.
 */
function renderedFieldShapes(
  resource: ResourceConfig,
  config: ResolvedAdminConfig,
  mode: "create" | "update",
): FormFieldShape[] {
  const { columns } = config.adapter.introspect(writeTarget(resource));
  const booleanColumns = new Set(columns.filter((c) => c.type === "boolean").map((c) => c.name));
  const byName = new Map(columns.map((c) => [c.name, c]));
  const formatting = resolveFormatting(config.formatting);
  const declared = declaredFormFields(resource, mode);
  if (!declared) {
    return formFieldDefs(resource, config, mode)
      .filter((f) => f.type === "checkbox" || f.type === "money")
      .map((f) => ({
        name: f.name,
        type: f.type,
        ...(f.type === "money" ? moneyShape(f, byName.get(f.name), formatting) : {}),
      }));
  }
  return declared
    .filter((f) => f.hidden === undefined || f.hidden === false)
    .map((f) => ({
      name: f.name,
      type: f.type ?? (booleanColumns.has(f.name) ? "boolean" : undefined),
      ...(f.type === "money" ? moneyShape(f, byName.get(f.name), formatting) : {}),
    }));
}

/** A `money` control that posted something other than an amount with the currency's decimals. */
function moneyErrors(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  mode: "create" | "update",
  fd: FormData,
  values: Record<string, unknown>,
  labels: ResolvedLabels,
): Record<string, string> {
  const formatting = resolveFormatting(config.formatting);
  const { columns } = config.adapter.introspect(writeTarget(resource));
  const errors: Record<string, string> = {};
  const fields = formFieldDefs(resource, config, mode);
  const labelOf = fieldLabels(resource, fields);
  for (const field of fields) {
    if (field.type !== "money") continue;
    const raw = fd.get(field.name);
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const shape = moneyShape(
      field,
      columns.find((c) => c.name === field.name),
      formatting,
    );
    if (parseMoney(raw, shape) !== null) continue;
    const decimals = moneyDecimals(raw);
    const message =
      decimals !== null && decimals > shape.minorUnits
        ? labels.form.moneyTooPrecise
        : labels.form.invalidMoney;
    errors[field.name] = formatLabel(message, {
      label: labelOf(field.name),
      example: moneyExample(shape, formatting.locale),
    });
    delete values[field.name];
  }
  return errors;
}

/**
 * FormData → plain object, decoded per control then coerced to each column's real JS type.
 * An edit that empties a NOT NULL column sends null, so the update schema reports it as required.
 */
function coerceFormData(
  fd: FormData,
  resource: ResourceConfig,
  config: ResolvedAdminConfig,
  mode: "create" | "update",
): { values: Record<string, unknown>; fieldErrors: Record<string, string> } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) raw[k] = v;
  Object.assign(raw, readFormValues(renderedFieldShapes(resource, config, mode), fd));
  const labels = mergeLabels(config.labels);
  const invalidMoney = moneyErrors(config, resource, mode, fd, raw, labels);
  const { columns } = config.adapter.introspect(writeTarget(resource));
  const coerced = coerceRowByColumns(
    columns,
    raw,
    labels,
    resolveFormatting(config.formatting).timeZone,
    fieldLabels(resource, declaredFormFields(resource, mode)),
  );
  const values = coerced.values;
  const fieldErrors = { ...coerced.fieldErrors, ...invalidMoney };
  for (const [k, v] of Object.entries(values)) {
    if (v === "") values[k] = null;
  }
  if (mode === "update") {
    for (const column of columns) {
      if (!column.nullable && raw[column.name] === "") values[column.name] = null;
    }
  }
  return { values, fieldErrors };
}

async function parseFormBody(
  req: Request,
  resource: ResourceConfig,
  config: ResolvedAdminConfig,
  mode: "create" | "update",
): Promise<
  | { ok: true; values: Record<string, unknown>; fieldErrors: Record<string, string> }
  | { ok: false; reason: RequestBodyError }
> {
  const parsed = await readRequestFormData(req);
  return parsed.ok ? { ok: true, ...coerceFormData(parsed.value, resource, config, mode) } : parsed;
}

/** A `FlowpanelError` as the form's answer; anything else goes back to `withGuards`, which reports it. */
function formActionError(err: unknown): Response {
  if (!(err instanceof FlowpanelError)) throw err;
  return actionFailure(err.code, err.safeMessage, {
    status: err.status,
    ...(err instanceof FlowpanelValidationError ? { fieldErrors: err.fieldErrors } : {}),
  });
}

function formResource(config: ResolvedAdminConfig, operation: "create" | "update") {
  return (params: { resource: string }) => {
    const resource = lookupResource(config, params.resource);
    if (resource instanceof Response) return resource;
    return { spec: { resource, operation }, target: resource };
  };
}

/** POST /<resource>/create — the generated create form. */
export function resourceCreateRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ resource: string }, ResourceConfig>(config, {
    resolve: formResource(config, "create"),
    handle: async ({ req, reqCtx, target: resource }) => {
      const parsed = await parseFormBody(req, resource, config, "create");
      if (!parsed.ok) return requestBodyErrorResponse(parsed.reason);
      try {
        const created = await makeActions(config, resource, { reqCtx, fromForm: true }).create(
          parsed.values,
          { decodeErrors: parsed.fieldErrors },
        );
        const key =
          created && typeof created === "object"
            ? (created as Record<string, unknown>)[rowKeyOf(resource)]
            : undefined;
        return Response.json({
          ok: true,
          ...(key !== undefined && key !== null ? { createdKey: String(key) } : {}),
        } satisfies FormActionResult);
      } catch (err) {
        return formActionError(err);
      }
    },
  });
}

/** POST /<resource>/<id>/edit — the generated edit form. */
export function resourceUpdateRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ resource: string; id: string }, ResourceConfig>(config, {
    resolve: formResource(config, "update"),
    handle: async ({ req, reqCtx, target: resource, params: { id } }) => {
      const parsed = await parseFormBody(req, resource, config, "update");
      if (!parsed.ok) return requestBodyErrorResponse(parsed.reason);
      try {
        await makeActions(config, resource, { reqCtx, fromForm: true }).update(id, parsed.values, {
          decodeErrors: parsed.fieldErrors,
        });
        return Response.json({ ok: true } satisfies FormActionResult);
      } catch (err) {
        return formActionError(err);
      }
    },
  });
}
