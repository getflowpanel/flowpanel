"use server";
import type {
  AuditEvent,
  MutationContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  assertResourceScope,
  checkRequireRole,
  emitAudit,
  FlowpanelNotFoundError,
  FlowpanelValidationError,
  type RequireRole,
  runWithRequestContext,
} from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { resourceNavName } from "../runtime/nav.js";
import { publishResource } from "../runtime/publish.js";
import { buildRequestContext } from "../runtime/request-setup.js";

interface Schemas {
  create: z.ZodTypeAny;
  update: z.ZodTypeAny;
}

function isSchemaPair(s: unknown): s is { create?: z.ZodTypeAny; update?: z.ZodTypeAny } {
  return typeof s === "object" && s !== null && ("create" in s || "update" in s);
}

function schemasFor(config: ResolvedAdminConfig, resource: ResourceConfig): Schemas {
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

function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}

export interface ResourceActions {
  create: (input: unknown) => Promise<unknown>;
  update: (id: string, input: unknown) => Promise<unknown>;
  delete: (id: string) => Promise<void>;
}

function actorIdFromSession(session: RequestContext["session"]): string | null {
  if (!session || typeof session !== "object") return null;
  const user = (session as { user?: unknown }).user;
  if (user && typeof user === "object" && "id" in user) {
    const id = (user as { id?: unknown }).id;
    return id === undefined || id === null ? null : String(id);
  }
  return null;
}

export function makeActions(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
): ResourceActions {
  const name = resourceNavName(resource);
  const schemas = schemasFor(config, resource);

  async function baseAudit(
    action: string,
    reqCtx: RequestContext,
    partial: Partial<AuditEvent>,
  ): Promise<void> {
    if (resource.options.audit === false) return;
    const actorId = actorIdFromSession(reqCtx.session);
    await emitAudit(config.audit, {
      actorId,
      action,
      resource: name,
      at: new Date(),
      ...(reqCtx.ip ? { ip: reqCtx.ip } : {}),
      ...(reqCtx.userAgent ? { userAgent: reqCtx.userAgent } : {}),
      ...partial,
    });
  }

  return {
    async create(input) {
      const req = new Request(`http://localhost/admin/${name}/new`);
      const reqCtx = await buildRequestContext({ req, config });
      checkRequireRole(resource.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);
      assertResourceScope({
        hasGlobal: !!config.scope,
        resourceScope: resource.options.scope as
          | "bypass"
          | ((...a: unknown[]) => unknown)
          | undefined,
      });

      const parsed = schemas.create.safeParse(input);
      if (!parsed.success) throw new FlowpanelValidationError(zodFieldErrors(parsed.error));

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: parsed.data as Partial<Record<string, unknown>>,
      };
      const row = (await runWithRequestContext(reqCtx, () =>
        config.adapter.create(resource.ref, mctx),
      )) as Record<string, unknown> | null | undefined;
      const rowId =
        row && typeof row === "object" && "id" in row ? (row as { id?: unknown }).id : undefined;
      await baseAudit(`${name}.create`, reqCtx, {
        ...(rowId !== undefined && rowId !== null ? { targetId: String(rowId) } : {}),
      });
      await publishResource(name, {
        action: "create",
        ...(rowId !== undefined && rowId !== null ? { id: String(rowId) } : {}),
      });
      revalidatePath(`/admin/${name}`);
      return row;
    },

    async update(id, input) {
      const req = new Request(`http://localhost/admin/${name}/${id}/edit`);
      const reqCtx = await buildRequestContext({ req, config });
      checkRequireRole(resource.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);
      assertResourceScope({
        hasGlobal: !!config.scope,
        resourceScope: resource.options.scope as
          | "bypass"
          | ((...a: unknown[]) => unknown)
          | undefined,
      });

      const parsed = schemas.update.safeParse(input);
      if (!parsed.success) throw new FlowpanelValidationError(zodFieldErrors(parsed.error));

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: parsed.data as Partial<Record<string, unknown>>,
        id,
      };
      const row = await runWithRequestContext(reqCtx, () =>
        config.adapter.update(resource.ref, mctx),
      );
      if (!row) throw new FlowpanelNotFoundError();
      await baseAudit(`${name}.update`, reqCtx, { targetId: id });
      await publishResource(name, { action: "update", id });
      revalidatePath(`/admin/${name}`);
      revalidatePath(`/admin/${name}/${id}`);
      return row;
    },

    async delete(id) {
      const req = new Request(`http://localhost/admin/${name}/${id}`);
      const reqCtx = await buildRequestContext({ req, config });
      checkRequireRole(resource.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);
      assertResourceScope({
        hasGlobal: !!config.scope,
        resourceScope: resource.options.scope as
          | "bypass"
          | ((...a: unknown[]) => unknown)
          | undefined,
      });

      const softDelete = resource.options.delete?.softDelete;
      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: {},
        id,
        ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
      };
      await runWithRequestContext(reqCtx, () => config.adapter.delete(resource.ref, mctx));
      await baseAudit(`${name}.delete`, reqCtx, { targetId: id });
      await publishResource(name, { action: "delete", id });
      revalidatePath(`/admin/${name}`);
    },
  };
}

export interface FormActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Returns a bound form action suitable for `<AutoForm action={...}>`.
 * Returns { ok: true } or { ok: false, error, fieldErrors }.
 */
export function makeFormAction(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  kind: "create" | "update",
  id?: string,
): (prev: FormActionResult | null, fd: FormData) => Promise<FormActionResult> {
  return async function formAction(
    _prev: FormActionResult | null,
    fd: FormData,
  ): Promise<FormActionResult> {
    "use server";
    const raw = Object.fromEntries(fd.entries());
    const input = coerceFormData(raw);
    const actions = makeActions(config, resource);
    try {
      if (kind === "create") {
        await actions.create(input);
      } else if (id) {
        await actions.update(id, input);
      }
      return { ok: true };
    } catch (e) {
      const err = e as {
        code?: string;
        fieldErrors?: Record<string, string>;
        safeMessage?: string;
      };
      if (err?.code === "validation" && err?.fieldErrors) {
        return {
          ok: false,
          ...(err.safeMessage ? { error: err.safeMessage } : {}),
          fieldErrors: err.fieldErrors,
        };
      }
      return { ok: false, error: err?.safeMessage ?? "Action failed" };
    }
  };
}

function coerceFormData(raw: Record<string, FormDataEntryValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === "") out[k] = null;
    else out[k] = v;
  }
  return out;
}
