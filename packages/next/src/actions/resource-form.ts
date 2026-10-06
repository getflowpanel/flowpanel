import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import {
  FlowpanelError,
  FlowpanelValidationError,
  mergeLabels,
  resolveFormatting,
} from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { notFoundResponse } from "../runtime/action-helpers";
import { coerceRowByColumns } from "../runtime/coerce-values";
import { DEFAULT_RESOURCE_ROW_KEY } from "../runtime/defaults";
import {
  type RequestBodyError,
  readRequestFormData,
  requestBodyErrorResponse,
} from "../runtime/request-body";
import { declaredFormFields } from "../runtime/resolve-form-fields";
import { withGuards } from "../runtime/with-guards";
import { declaredWriteFields } from "./field-pipeline";
import { type FormFieldShape, readFormValues } from "./form-values";
import { type FormActionResult, makeActions } from "./resource-actions";

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
  const declared = declaredFormFields(resource, mode);
  const writable = new Set(declaredWriteFields(resource, declared));
  if (!declared) {
    return [...booleanColumns]
      .filter((name) => writable.has(name))
      .map((name) => ({ name, type: "boolean" }));
  }
  return declared
    .filter((f) => f.hidden === undefined || f.hidden === false)
    .map((f) => ({
      name: f.name,
      type: f.type ?? (booleanColumns.has(f.name) ? "boolean" : undefined),
    }));
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
  const { columns } = config.adapter.introspect(writeTarget(resource));
  const { values, fieldErrors } = coerceRowByColumns(
    columns,
    raw,
    mergeLabels(config.labels),
    resolveFormatting(config.formatting).timeZone,
  );
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
  if (err instanceof FlowpanelValidationError) {
    return Response.json(
      {
        ok: false,
        error: err.safeMessage,
        fieldErrors: err.fieldErrors,
      } satisfies FormActionResult,
      { status: err.status },
    );
  }
  if (err instanceof FlowpanelError) {
    return Response.json({ ok: false, error: err.safeMessage } satisfies FormActionResult, {
      status: err.status,
    });
  }
  throw err;
}

export function resourceCreateRoute(config: ResolvedAdminConfig) {
  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string }> },
  ): Promise<Response> {
    const { resource: resourceName } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }
    if (resource.options.create?.disabled) {
      return Response.json({ ok: false, error: "create is disabled" }, { status: 403 });
    }

    return withGuards(config, req, { resource, operation: "create" }, async (reqCtx) => {
      const parsed = await parseFormBody(req, resource, config, "create");
      if (!parsed.ok) return requestBodyErrorResponse(parsed.reason);

      const actions = makeActions(config, resource, { reqCtx, fromForm: true });
      try {
        if (Object.keys(parsed.fieldErrors).length > 0) {
          throw new FlowpanelValidationError(parsed.fieldErrors);
        }
        const created = await actions.create(parsed.values);
        const rowKey = (resource.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY;
        const createdValue =
          created && typeof created === "object"
            ? (created as Record<string, unknown>)[rowKey]
            : undefined;
        return Response.json({
          ok: true,
          ...(createdValue !== undefined && createdValue !== null
            ? { createdKey: String(createdValue) }
            : {}),
        } satisfies FormActionResult);
      } catch (err) {
        return formActionError(err);
      }
    });
  };
}

export function resourceUpdateRoute(config: ResolvedAdminConfig) {
  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string; id: string }> },
  ): Promise<Response> {
    const { resource: resourceName, id } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }
    if (resource.options.update?.disabled) {
      return Response.json({ ok: false, error: "editing is disabled" }, { status: 403 });
    }

    return withGuards(config, req, { resource, operation: "update" }, async (reqCtx) => {
      const parsed = await parseFormBody(req, resource, config, "update");
      if (!parsed.ok) return requestBodyErrorResponse(parsed.reason);

      const actions = makeActions(config, resource, { reqCtx, fromForm: true });
      try {
        if (Object.keys(parsed.fieldErrors).length > 0) {
          throw new FlowpanelValidationError(parsed.fieldErrors);
        }
        await actions.update(id, parsed.values);
        return Response.json({ ok: true } satisfies FormActionResult);
      } catch (err) {
        return formActionError(err);
      }
    });
  };
}
