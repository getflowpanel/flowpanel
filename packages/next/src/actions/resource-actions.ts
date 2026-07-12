import type {
  AuditEvent,
  MutationContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  emitAudit,
  FlowpanelAccessError,
  FlowpanelNotFoundError,
  FlowpanelValidationError,
  runWithRequestContext,
} from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { actorIdFromSession } from "../runtime/action-helpers.js";
import { buildServerRequest } from "../runtime/build-server-request.js";
import { buildHref } from "../runtime/href.js";
import { resourceNavName } from "../runtime/nav.js";
import { bindPublisher, publishResource } from "../runtime/publish.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { requireAuthorized } from "../runtime/require-authorized.js";
import { declaredFormFields } from "../runtime/resolve-form-fields.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import {
  applyFieldDefaults,
  friendlyFieldErrors,
  runFieldValidators,
  schemasFor,
  stripNonWritableFields,
  throwIfStrippedRequired,
} from "./field-pipeline.js";

export interface ResourceActions {
  create: (input: unknown) => Promise<unknown>;
  update: (id: string, input: unknown) => Promise<unknown>;
  delete: (id: string) => Promise<void>;
}

export interface MakeActionsOptions {
  /** Reuse a caller-built `RequestContext` instead of building one per call. */
  reqCtx?: RequestContext;
}

export function makeActions(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  opts: MakeActionsOptions = {},
): ResourceActions {
  bindPublisher(config);
  const name = resourceNavName(resource);
  const schemas = schemasFor(config, resource);

  async function ctxFor(path: string): Promise<RequestContext> {
    if (opts.reqCtx) return opts.reqCtx;
    return buildRequestContext({
      req: await buildServerRequest(`http://localhost${path}`),
      config,
    });
  }

  async function baseAudit(
    action: string,
    reqCtx: RequestContext,
    partial: Partial<AuditEvent>,
  ): Promise<void> {
    if (resource.options.audit === false) return;
    const actorId = actorIdFromSession(reqCtx.session, config.auth.userId);
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
      const reqCtx = await ctxFor(buildHref(config, name, "new"));
      requireAuthorized(config, resource, reqCtx);
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");

      const fields = declaredFormFields(resource, "create");
      const { safe, stripped } = stripNonWritableFields(fields, input, reqCtx);
      const withDefaults = await applyFieldDefaults(config, fields, safe, reqCtx);
      const parsed = schemas.create.safeParse(withDefaults);
      if (!parsed.success) {
        const fieldErrors = friendlyFieldErrors(fields, withDefaults, parsed.error);
        throwIfStrippedRequired(stripped, fieldErrors);
        throw new FlowpanelValidationError(fieldErrors);
      }
      const ruleErrors = await runFieldValidators(fields, parsed.data as Record<string, unknown>);
      if (ruleErrors) throw new FlowpanelValidationError(ruleErrors);

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: parsed.data as Partial<Record<string, unknown>>,
        ...scopeBinding(config, resource, reqCtx),
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
      revalidatePath(buildHref(config, name));
      return row;
    },

    async update(id, input) {
      const reqCtx = await ctxFor(buildHref(config, name, id, "edit"));
      requireAuthorized(config, resource, reqCtx);
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");

      const fields = declaredFormFields(resource, "update");
      const { safe, stripped } = stripNonWritableFields(fields, input, reqCtx);
      const parsed = schemas.update.safeParse(safe);
      if (!parsed.success) {
        const fieldErrors = friendlyFieldErrors(fields, safe, parsed.error);
        throwIfStrippedRequired(stripped, fieldErrors);
        throw new FlowpanelValidationError(fieldErrors);
      }
      const ruleErrors = await runFieldValidators(fields, parsed.data as Record<string, unknown>);
      if (ruleErrors) throw new FlowpanelValidationError(ruleErrors);

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: parsed.data as Partial<Record<string, unknown>>,
        id,
        ...scopeBinding(config, resource, reqCtx),
      };
      const row = await runWithRequestContext(reqCtx, () =>
        config.adapter.update(resource.ref, mctx),
      );
      if (!row) throw new FlowpanelNotFoundError();
      await baseAudit(`${name}.update`, reqCtx, { targetId: id });
      await publishResource(name, { action: "update", id });
      revalidatePath(buildHref(config, name));
      revalidatePath(buildHref(config, name, id));
      return row;
    },

    async delete(id) {
      const reqCtx = await ctxFor(buildHref(config, name, id));
      requireAuthorized(config, resource, reqCtx);
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");

      const softDelete = resource.options.delete?.softDelete;
      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: {},
        id,
        ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
        ...scopeBinding(config, resource, reqCtx),
      };
      await runWithRequestContext(reqCtx, () => config.adapter.delete(resource.ref, mctx));
      await baseAudit(`${name}.delete`, reqCtx, { targetId: id });
      await publishResource(name, { action: "delete", id });
      revalidatePath(buildHref(config, name));
    },
  };
}

export interface FormActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
