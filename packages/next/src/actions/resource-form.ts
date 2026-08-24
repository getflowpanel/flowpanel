import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { FlowpanelValidationError } from "@flowpanel/core";
import { coerceRowByColumns } from "../runtime/coerce-values.js";
import { withGuards } from "../runtime/with-guards.js";
import { type FormActionResult, makeActions } from "./resource-actions.js";

/** FormData → plain object, coerced to each column's real JS type via `coerceRowByColumns`. */
function coerceFormData(
  fd: FormData,
  resource: ResourceConfig,
  config: ResolvedAdminConfig,
): { values: Record<string, unknown>; fieldErrors: Record<string, string> } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) raw[k] = v;
  const { columns } = config.adapter.introspect(resource.ref);
  const { values, fieldErrors } = coerceRowByColumns(columns, raw);
  for (const [k, v] of Object.entries(values)) {
    if (v === "") values[k] = null;
  }
  return { values, fieldErrors };
}

async function parseFormBody(
  req: Request,
  resource: ResourceConfig,
  config: ResolvedAdminConfig,
): Promise<{ values: Record<string, unknown>; fieldErrors: Record<string, string> } | null> {
  try {
    return coerceFormData(await req.formData(), resource, config);
  } catch {
    return null;
  }
}

function errorResult(err: unknown): { status: number; body: FormActionResult } {
  const e = err as {
    code?: string;
    fieldErrors?: Record<string, string>;
    safeMessage?: string;
    status?: number;
  };
  const status = typeof e?.status === "number" ? e.status : 500;
  if (e?.code === "validation_failed" && e.fieldErrors) {
    return {
      status,
      body: {
        ok: false,
        ...(e.safeMessage ? { error: e.safeMessage } : {}),
        fieldErrors: e.fieldErrors,
      },
    };
  }
  return { status, body: { ok: false, error: e?.safeMessage ?? "Action failed" } };
}

export function resourceCreateRoute(config: ResolvedAdminConfig) {
  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string }> },
  ): Promise<Response> {
    const { resource: resourceName } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }
    if (resource.options.create?.disabled) {
      return Response.json({ ok: false, error: "create is disabled" }, { status: 403 });
    }

    return withGuards(config, req, { resource, operation: "create" }, async (reqCtx) => {
      const parsed = await parseFormBody(req, resource, config);
      if (parsed === null) {
        return Response.json({ ok: false, error: "invalid form data" }, { status: 400 });
      }

      const actions = makeActions(config, resource, { reqCtx });
      try {
        if (Object.keys(parsed.fieldErrors).length > 0) {
          throw new FlowpanelValidationError(parsed.fieldErrors);
        }
        await actions.create(parsed.values);
        return Response.json({ ok: true } satisfies FormActionResult);
      } catch (err) {
        const { status, body } = errorResult(err);
        return Response.json(body, { status });
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
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }
    if (resource.options.update?.disabled) {
      return Response.json({ ok: false, error: "editing is disabled" }, { status: 403 });
    }

    return withGuards(config, req, { resource, operation: "update" }, async (reqCtx) => {
      const parsed = await parseFormBody(req, resource, config);
      if (parsed === null) {
        return Response.json({ ok: false, error: "invalid form data" }, { status: 400 });
      }

      const actions = makeActions(config, resource, { reqCtx });
      try {
        if (Object.keys(parsed.fieldErrors).length > 0) {
          throw new FlowpanelValidationError(parsed.fieldErrors);
        }
        await actions.update(id, parsed.values);
        return Response.json({ ok: true } satisfies FormActionResult);
      } catch (err) {
        const { status, body } = errorResult(err);
        return Response.json(body, { status });
      }
    });
  };
}
