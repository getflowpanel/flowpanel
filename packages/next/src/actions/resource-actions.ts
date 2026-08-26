import type {
  AuditEvent,
  ItemQueryContext,
  MutationContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  authorizeOperation,
  emitAudit,
  FlowpanelAccessError,
  FlowpanelNotFoundError,
  FlowpanelOperationDisabledError,
  FlowpanelValidationError,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { actorIdFromSession } from "../runtime/action-helpers";
import { buildServerRequest } from "../runtime/build-server-request";
import { deleteRow } from "../runtime/delete-row";
import { buildHref } from "../runtime/href";
import { resourceNavName } from "../runtime/nav";
import { bindPublisher, publishResource } from "../runtime/publish";
import { buildRequestContext } from "../runtime/request-setup";
import { requireAuthorized } from "../runtime/require-authorized";
import { declaredFormFields } from "../runtime/resolve-form-fields";
import { scopeBinding } from "../runtime/scope-binding";
import {
  applyFieldDefaults,
  assertResourceWritableInput,
  friendlyFieldErrors,
  runFieldValidators,
  schemasFor,
} from "./field-pipeline";

export interface ResourceActions {
  create: (input: unknown) => Promise<unknown>;
  update: (id: string, input: unknown) => Promise<unknown>;
  delete: (id: string) => Promise<void>;
}

export interface MakeActionsOptions {
  /** Reuse a caller-built `RequestContext` instead of building one per call. */
  reqCtx?: RequestContext;
  /** Publish + revalidate per call. Default `true`; set `false` to batch-notify once yourself. */
  publish?: boolean;
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

  async function runPostCommitEffects(
    payload: { action: "create" | "update" | "delete"; id?: string },
    paths: string[],
  ): Promise<void> {
    if (opts.publish === false) return;
    try {
      await publishResource(name, payload);
    } catch (error) {
      console.error("[flowpanel] realtime effect failed", error);
    }
    for (const path of paths) {
      try {
        revalidatePath(path);
      } catch (error) {
        console.error("[flowpanel] revalidation effect failed", error);
      }
    }
  }

  return {
    async create(input) {
      const reqCtx = await ctxFor(buildHref(config, name, "new"));
      requireAuthorized(config, resource, reqCtx);
      await authorizeOperation(
        resolveOperationAccess(resource.options.access, resource.options.requireRole, "create"),
        reqCtx,
      );
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");
      if (resource.options.create?.disabled) {
        throw new FlowpanelOperationDisabledError("Create is disabled for this resource.");
      }

      const fields = declaredFormFields(resource, "create");
      const safe = await assertResourceWritableInput(resource, fields, input, null, reqCtx);
      const withDefaults = await applyFieldDefaults(config, resource, fields, safe, reqCtx);
      const parsed = schemas.create.safeParse(withDefaults);
      if (!parsed.success) {
        const fieldErrors = friendlyFieldErrors(fields, withDefaults, parsed.error);
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
      await runPostCommitEffects(
        {
          action: "create",
          ...(rowId !== undefined && rowId !== null ? { id: String(rowId) } : {}),
        },
        [buildHref(config, name)],
      );
      return row;
    },

    async update(id, input) {
      const reqCtx = await ctxFor(buildHref(config, name, id, "edit"));
      requireAuthorized(config, resource, reqCtx);
      await authorizeOperation(
        resolveOperationAccess(resource.options.access, resource.options.requireRole, "update"),
        reqCtx,
      );
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");
      if (resource.options.update?.disabled) {
        throw new FlowpanelOperationDisabledError("Update is disabled for this resource.");
      }

      const fields = declaredFormFields(resource, "update");
      const itemCtx: ItemQueryContext = {
        ...reqCtx,
        db: config.adapter.db,
        dateRange: { from: new Date(0), to: new Date() },
        searchParams: new URLSearchParams(),
        signal: new AbortController().signal,
        id,
        ...scopeBinding(config, resource, reqCtx),
      };
      const current = (await runWithRequestContext(reqCtx, () =>
        config.adapter.get(resource.ref, itemCtx),
      )) as Record<string, unknown> | null;
      if (!current) throw new FlowpanelNotFoundError();
      const safe = await assertResourceWritableInput(resource, fields, input, current, reqCtx);
      const parsed = schemas.update.safeParse(safe);
      if (!parsed.success) {
        const fieldErrors = friendlyFieldErrors(fields, safe, parsed.error);
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
      await runPostCommitEffects({ action: "update", id }, [
        buildHref(config, name),
        buildHref(config, name, id),
      ]);
      return row;
    },

    async delete(id) {
      const reqCtx = await ctxFor(buildHref(config, name, id));
      requireAuthorized(config, resource, reqCtx);
      await authorizeOperation(
        resolveOperationAccess(resource.options.access, resource.options.requireRole, "delete"),
        reqCtx,
      );
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");
      if (resource.options.delete?.disabled) {
        throw new FlowpanelOperationDisabledError("Delete is disabled for this resource.");
      }

      await deleteRow(config, resource, id, reqCtx);
      await baseAudit(`${name}.delete`, reqCtx, { targetId: id });
      await runPostCommitEffects({ action: "delete", id }, [buildHref(config, name)]);
    },
  };
}

export interface FormActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
