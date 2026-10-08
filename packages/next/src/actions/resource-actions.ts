import type {
  AuditEvent,
  ItemQueryContext,
  MutationContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  FlowpanelAccessError,
  FlowpanelNotFoundError,
  FlowpanelOperationDisabledError,
  FlowpanelValidationError,
  mergeLabels,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { emitAudit, writeTarget } from "@flowpanel/core/internal";
import { revalidatePath } from "next/cache";
import { actorIdFromSession } from "../runtime/action-helpers";
import { buildServerRequest } from "../runtime/build-server-request";
import { explainWrite } from "../runtime/constraint-error";
import { deleteRow } from "../runtime/delete-row";
import { keepUntouchedTimes } from "../runtime/form-dates";
import { buildHref } from "../runtime/href";
import { resourceNavName } from "../runtime/nav";
import { bindPublisher, publishResource } from "../runtime/publish";
import { readRow } from "../runtime/read-row";
import { buildRequestContext } from "../runtime/request-setup";
import { requireAccessIfSet } from "../runtime/require-access";
import { requireAuthorized } from "../runtime/require-authorized";
import { declaredFormFields, deniedFieldWrites } from "../runtime/resolve-form-fields";
import { rowKeyOf } from "../runtime/row-identity";
import { scopeBinding } from "../runtime/scope-binding";
import {
  applyFieldDefaults,
  assertResourceWritableInput,
  formInput,
  friendlyFieldErrors,
  missingRequiredErrors,
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
  /** The input is a posted form, which also carries the fields it showed read-only. */
  fromForm?: boolean;
}

function dateColumnsOf(config: ResolvedAdminConfig, resource: ResourceConfig): Set<string> {
  const { columns } = config.adapter.introspect(writeTarget(resource));
  return new Set(columns.filter((c) => c.type === "date").map((c) => c.name));
}

export function makeActions(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  opts: MakeActionsOptions = {},
): ResourceActions {
  bindPublisher(config);
  const name = resourceNavName(resource);
  const schemas = schemasFor(config, resource);
  const labels = mergeLabels(config.labels);

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
      requireAuthorized(config, resource);
      await requireAccessIfSet(resolveOperationAccess(resource.options.access, "create"), reqCtx);
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");
      if (resource.options.create?.disabled) {
        throw new FlowpanelOperationDisabledError("Create is disabled for this resource.");
      }

      const fields = declaredFormFields(resource, "create");
      const denied = await deniedFieldWrites(resource, reqCtx, null);
      const submitted = opts.fromForm ? formInput(fields, input, null, denied) : input;
      const safe = await assertResourceWritableInput(resource, fields, submitted, null, reqCtx);
      const withDefaults = await applyFieldDefaults(resource, fields, safe, reqCtx);
      const missing = missingRequiredErrors(fields, withDefaults, null, labels, denied);
      const parsed = schemas.create.safeParse(withDefaults);
      if (!parsed.success) {
        const fieldErrors = friendlyFieldErrors(fields, withDefaults, parsed.error, labels);
        throw new FlowpanelValidationError({ ...fieldErrors, ...missing });
      }
      if (Object.keys(missing).length > 0) throw new FlowpanelValidationError(missing);
      const ruleErrors = await runFieldValidators(fields, parsed.data as Record<string, unknown>);
      if (ruleErrors) throw new FlowpanelValidationError(ruleErrors);

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: parsed.data as Partial<Record<string, unknown>>,
        ...scopeBinding(resource, reqCtx),
      };
      const row = (await explainWrite(config, resource, "create", () =>
        runWithRequestContext(reqCtx, () => config.adapter.create(writeTarget(resource), mctx)),
      )) as Record<string, unknown> | null | undefined;
      const rowKey = rowKeyOf(resource);
      const rowId = row && typeof row === "object" ? row[rowKey] : undefined;
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
      requireAuthorized(config, resource);
      await requireAccessIfSet(resolveOperationAccess(resource.options.access, "update"), reqCtx);
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");
      if (resource.options.update?.disabled) {
        throw new FlowpanelOperationDisabledError("Update is disabled for this resource.");
      }

      const fields = declaredFormFields(resource, "update");
      const itemCtx: ItemQueryContext = {
        ...reqCtx,
        dateRange: { from: new Date(0), to: new Date() },
        searchParams: new URLSearchParams(),
        signal: new AbortController().signal,
        id,
        ...scopeBinding(resource, reqCtx),
      };
      const current = (await runWithRequestContext(reqCtx, () =>
        config.adapter.get(resource.ref, itemCtx),
      )) as Record<string, unknown> | null;
      if (!current) throw new FlowpanelNotFoundError();
      const denied = await deniedFieldWrites(resource, reqCtx, current);
      const submitted = opts.fromForm
        ? keepUntouchedTimes(
            formInput(fields, input, current, denied),
            current,
            dateColumnsOf(config, resource),
          )
        : input;
      const safe = await assertResourceWritableInput(resource, fields, submitted, current, reqCtx);
      const missing = missingRequiredErrors(fields, safe, current, labels, denied);
      const parsed = schemas.update.safeParse(safe);
      if (!parsed.success) {
        const fieldErrors = friendlyFieldErrors(fields, safe, parsed.error, labels);
        throw new FlowpanelValidationError({ ...fieldErrors, ...missing });
      }
      if (Object.keys(missing).length > 0) throw new FlowpanelValidationError(missing);
      const ruleErrors = await runFieldValidators(fields, parsed.data as Record<string, unknown>);
      if (ruleErrors) throw new FlowpanelValidationError(ruleErrors);

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: parsed.data as Partial<Record<string, unknown>>,
        id,
        ...scopeBinding(resource, reqCtx),
      };
      const written = await explainWrite(config, resource, "update", () =>
        runWithRequestContext(reqCtx, () => config.adapter.update(writeTarget(resource), mctx)),
      );
      if (!written) throw new FlowpanelNotFoundError();
      const row =
        resource.options.writeTo === undefined
          ? written
          : ((await runWithRequestContext(reqCtx, () =>
              config.adapter.get(resource.ref, itemCtx),
            )) ?? written);
      await baseAudit(`${name}.update`, reqCtx, { targetId: id });
      await runPostCommitEffects({ action: "update", id }, [
        buildHref(config, name),
        buildHref(config, name, id),
      ]);
      return row;
    },

    async delete(id) {
      const reqCtx = await ctxFor(buildHref(config, name, id));
      requireAuthorized(config, resource);
      await requireAccessIfSet(resolveOperationAccess(resource.options.access, "delete"), reqCtx);
      if (config.readOnly) throw new FlowpanelAccessError("This admin is read-only.");
      if (resource.options.delete?.disabled) {
        throw new FlowpanelOperationDisabledError("Delete is disabled for this resource.");
      }

      const current = await readRow(config, resource, id, reqCtx);
      if (!current) throw new FlowpanelNotFoundError();

      await deleteRow(config, resource, id, reqCtx);
      await baseAudit(`${name}.delete`, reqCtx, { targetId: id });
      await runPostCommitEffects({ action: "delete", id }, [buildHref(config, name)]);
    },
  };
}

export interface FormActionResult {
  ok: boolean;
  /** Stable row key returned by create routes so the destination list can animate that row. */
  createdKey?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}
