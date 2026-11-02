import type {
  ActionVariant,
  BulkAction,
  IconName,
  PluralLabel,
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
import { resourceActionTarget } from "../runtime/action-gate";
import { auditTargets } from "../runtime/audit-tenant";
import { buildHref } from "../runtime/href";
import { readLiveRow } from "../runtime/read-row";
import {
  commitEffects,
  guardedRoute,
  invokeDeclaredAction,
  lookupAction,
  lookupResource,
  parseDeclaredInput,
} from "../runtime/write-pipeline";
import type { ActionFormField } from "./action-form-field";
import {
  bulkBodyFailure,
  deleteSelection,
  EXISTENCE_CHECKS_AT_ONCE,
  eachLimited,
  MAX_BULK,
  parseBulkBody,
} from "./bulk-selection";
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
        spec: resourceActionTarget(resource, action),
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
        const labels = mergeLabels(config.labels);
        return actionFailure(
          "validation_failed",
          formatLabel(labels.errors.tooManySelected, { max }),
        );
      }

      const input = builtinDelete
        ? {}
        : await parseDeclaredInput(config, reqCtx, action, body.input);
      if (input instanceof Response) return input;

      const rows = new Map<string, Record<string, unknown>>();
      await eachLimited(ids, EXISTENCE_CHECKS_AT_ONCE, async (id) => {
        const row = await readLiveRow(config, resource, id, reqCtx);
        if (!row) throw new FlowpanelNotFoundError();
        rows.set(id, row);
      });

      const effects = {
        audit: {
          action: `${name}.bulk.${action.key}`,
          resource: name,
          targetId: auditTargets(ids),
          targetIds: ids,
          rows,
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
