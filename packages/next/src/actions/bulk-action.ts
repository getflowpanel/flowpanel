import type {
  ActionVariant,
  BulkAction,
  IconName,
  PluralLabel,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import {
  DEFAULT_LABELS,
  FlowpanelError,
  FlowpanelNotFoundError,
  formatLabel,
  mergeLabels,
} from "@flowpanel/core";
import { isBuiltinBulkDelete } from "@flowpanel/core/internal";
import { actionFailure } from "../runtime/action-failure";
import { invalidJsonResponse } from "../runtime/action-helpers";
import { deleteRow } from "../runtime/delete-row";
import { buildHref } from "../runtime/href";
import { readRow } from "../runtime/read-row";
import {
  formDataObject,
  type RequestBodyError,
  readJsonObject,
  readRequestFormData,
} from "../runtime/request-body";
import {
  commitEffects,
  guardedRoute,
  invokeDeclaredAction,
  lookupAction,
  lookupResource,
  parseDeclaredInput,
} from "../runtime/write-pipeline";
import type { ActionFormField } from "./action-form-field";
import { serializeActionForm } from "./serialize-action-field";

/** Wire-safe shape of `BulkAction`. */
export interface SerializedBulkAction {
  key: string;
  label: string;
  icon?: IconName;
  variant?: ActionVariant;
  /** A `PluralLabel` form is worded for the selection's size; `{n}` is the count. */
  confirm?: {
    title: string;
    description?: string | PluralLabel;
    confirmLabel?: string;
  };
  hasForm: boolean;
  form?: ActionFormField[];
}

/** Serialize a `BulkAction` for client consumption. */
export function serializeBulkAction<Row>(
  a: BulkAction<Row>,
  labels: ResolvedLabels = DEFAULT_LABELS,
  resource?: ResourceConfig,
): SerializedBulkAction {
  const hasForm = Array.isArray(a.form) && a.form.length > 0;
  if (isBuiltinBulkDelete(a)) {
    const del = resource?.options.delete;
    const soft = del?.softDelete !== undefined;
    return {
      key: a.key,
      label: labels.actions.delete,
      variant: "destructive",
      hasForm: false,
      confirm: {
        title: labels.confirm.deleteSelectedTitle,
        description:
          del?.confirm ??
          (soft ? labels.confirm.softDeleteDescription : labels.confirm.deleteDescription),
      },
    };
  }
  const out: SerializedBulkAction = {
    key: a.key,
    label: a.label,
    hasForm,
  };
  if (a.icon !== undefined) out.icon = a.icon;
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.confirm !== undefined) {
    out.confirm = typeof a.confirm === "string" ? { title: a.confirm } : a.confirm;
  }
  if (hasForm) {
    const serialized = serializeActionForm(a.form as Parameters<typeof serializeActionForm>[0]);
    if (serialized) out.form = serialized;
  }
  return out;
}

type BulkBody =
  | { ok: true; ids: string[]; input: Record<string, unknown> }
  | { ok: false; reason: RequestBodyError | "ids" | "input" };

/** Parses the incoming request body for the array of selected IDs. */
async function parseBulkBody(req: Request): Promise<BulkBody> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await readJsonObject(req);
    if (!payload.ok) return payload;
    const obj = payload.value as { ids?: unknown; input?: unknown };
    if (!Array.isArray(obj.ids)) return { ok: false, reason: "ids" };
    const ids = obj.ids.filter((v): v is string => typeof v === "string");
    if (ids.length === 0) return { ok: false, reason: "ids" };
    const input = obj.input ?? {};
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return { ok: false, reason: "input" };
    }
    return { ok: true, ids, input: input as Record<string, unknown> };
  }
  const parsedForm = await readRequestFormData(req);
  if (!parsedForm.ok) return parsedForm;
  const form = parsedForm.value;
  const raw = form.getAll("ids");
  const ids: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    if (v.includes(","))
      ids.push(
        ...v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    else if (v) ids.push(v);
  }
  if (ids.length === 0) return { ok: false, reason: "ids" };
  const input = formDataObject(form);
  delete input.ids;
  return { ok: true, ids, input };
}

/** Hard cap on the number of ids a single bulk action may target. */
const MAX_BULK = 1000;
const EXISTENCE_CHECKS_AT_ONCE = 16;

/** Runs `check` over `ids` with at most `limit` in flight; the first rejection rejects the run. */
async function eachLimited(
  ids: readonly string[],
  limit: number,
  check: (id: string) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    for (let id = ids[next++]; id !== undefined && !failed; id = ids[next++]) {
      try {
        await check(id);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, worker));
}

function bulkBodyFailure(reason: Exclude<BulkBody, { ok: true }>["reason"]): Response {
  if (reason === "input") return actionFailure("bad_request", "input must be an object");
  if (reason === "ids") {
    return actionFailure("bad_request", "ids must be a non-empty array of strings");
  }
  return invalidJsonResponse(reason);
}

function auditTargets(ids: readonly string[]): string {
  return ids.slice(0, 10).join(",") + (ids.length > 10 ? "…" : "");
}

/** The whole selection in one transaction where the driver holds one, else row by row up to the first failure. */
async function deleteSelection(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  ids: readonly string[],
  reqCtx: RequestContext,
): Promise<{ deleted: string[]; failure?: unknown }> {
  const transaction = config.adapter.transaction;
  if (transaction) {
    let started = false;
    try {
      await transaction.call(config.adapter, async (db) => {
        started = true;
        for (const id of ids) await deleteRow(config, resource, id, reqCtx, db);
      });
      return { deleted: [...ids] };
    } catch (err) {
      if (started || err instanceof FlowpanelError) throw err;
    }
  }
  const deleted: string[] = [];
  for (const id of ids) {
    try {
      await deleteRow(config, resource, id, reqCtx);
    } catch (failure) {
      return { deleted, failure };
    }
    deleted.push(id);
  }
  return { deleted };
}

export function bulkActionRoute(config: ResolvedAdminConfig) {
  return guardedRoute<
    { resource: string; action: string },
    {
      resource: ResourceConfig;
      action: BulkAction<Record<string, unknown>>;
      builtinDelete: boolean;
    }
  >(config, {
    resolve: (params) => {
      const resource = lookupResource(config, params.resource);
      if (resource instanceof Response) return resource;
      const actions = resource.options.bulkActions as
        | BulkAction<Record<string, unknown>>[]
        | undefined;
      const action = lookupAction(actions, params.action);
      if (action instanceof Response) return action;
      const builtinDelete = isBuiltinBulkDelete(action);
      return {
        spec: {
          resource,
          actionAccess: action.access,
          ...(builtinDelete ? { operation: "delete" as const } : {}),
        },
        target: { resource, action, builtinDelete },
      };
    },
    handle: async ({ req, reqCtx, target: { resource, action, builtinDelete }, params }) => {
      const name = params.resource;
      const body = await parseBulkBody(req);
      if (!body.ok) return bulkBodyFailure(body.reason);
      const ids = [...new Set(body.ids)];
      const max = action.max ?? MAX_BULK;
      if (ids.length > max) {
        return actionFailure("validation_failed", `too many ids (max ${max})`);
      }

      const input = builtinDelete
        ? {}
        : await parseDeclaredInput(config, reqCtx, action, body.input);
      if (input instanceof Response) return input;

      await eachLimited(ids, EXISTENCE_CHECKS_AT_ONCE, async (id) => {
        const row = await readRow(config, resource, id, reqCtx);
        if (!row) throw new FlowpanelNotFoundError();
      });

      const effects = {
        audit: {
          action: `${name}.bulk.${action.key}`,
          resource: name,
          targetId: auditTargets(ids),
          targetIds: ids,
        },
        resourceAudit: resource.options.audit,
        publish: {
          resourceName: name,
          pathname: buildHref(config, name),
          ...(builtinDelete ? { change: { action: "delete" as const } } : {}),
        },
      };
      if (!builtinDelete) {
        return invokeDeclaredAction(
          config,
          reqCtx,
          action,
          input,
          (parsed, actionCtx) => action.run(ids, parsed, actionCtx),
          effects,
        );
      }

      const { deleted, failure } = await deleteSelection(config, resource, ids, reqCtx);
      if (deleted.length > 0) {
        await commitEffects(
          config,
          reqCtx,
          { ok: true },
          {
            ...effects,
            audit: { ...effects.audit, targetId: auditTargets(deleted), targetIds: deleted },
          },
        );
      }
      if (failure === undefined) return Response.json({ ok: true });
      if (deleted.length === 0 || !(failure instanceof FlowpanelError)) throw failure;
      const done = formatLabel(mergeLabels(config.labels).actions.deletedSome, {
        done: deleted.length,
        total: ids.length,
      });
      return actionFailure(failure.code, `${done} ${failure.safeMessage}`, {
        status: failure.status,
      });
    },
  });
}
