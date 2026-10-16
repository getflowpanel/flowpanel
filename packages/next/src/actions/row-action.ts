import type { IconName, ResolvedAdminConfig, ResourceConfig, RowAction } from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { actionFailure } from "../runtime/action-failure";
import { actionAppliesTo, resourceActionTarget } from "../runtime/action-gate";
import { buildHref } from "../runtime/href";
import { readLiveRow, readRow } from "../runtime/read-row";
import {
  auditDiff,
  guardedRoute,
  lookupAction,
  lookupResource,
  readActionBody,
  rowNotFound,
  runDeclaredAction,
} from "../runtime/write-pipeline";
import type { ActionFormField } from "./action-form-field";
import { serializeActionForm } from "./serialize-action-field";

/** Wire-safe shape of `RowAction`. */
export interface SerializedRowAction {
  key: string;
  label: string;
  icon?: IconName;
  variant?: "default" | "destructive" | "success";
  placement?: "inline" | "menu";
  confirm?: { title: string; description?: string; confirmLabel?: string };
  hasForm: boolean;
  form?: ActionFormField[];
}

/** Serialize a `RowAction` for client consumption. */
export function serializeRowAction<Row>(a: RowAction<Row>): SerializedRowAction {
  const hasForm = Array.isArray(a.form) && a.form.length > 0;
  const out: SerializedRowAction = {
    key: a.key,
    label: a.label,
    hasForm,
  };
  if (a.icon !== undefined) out.icon = a.icon;
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.placement !== undefined) out.placement = a.placement;
  if (a.confirm !== undefined) {
    out.confirm = typeof a.confirm === "string" ? { title: a.confirm } : a.confirm;
  }
  if (hasForm) {
    const serialized = serializeActionForm(a.form as Parameters<typeof serializeActionForm>[0]);
    if (serialized) out.form = serialized;
  }
  return out;
}

export function rowActionRoute(config: ResolvedAdminConfig) {
  return guardedRoute<
    { resource: string; id: string; action: string },
    { resource: ResourceConfig; action: RowAction<Record<string, unknown>> }
  >(config, {
    resolve: (params) => {
      const resource = lookupResource(config, params.resource);
      if (resource instanceof Response) return resource;
      const actions = resource.options.actions as RowAction<Record<string, unknown>>[] | undefined;
      const action = lookupAction(actions, params.action);
      if (action instanceof Response) return action;
      return { spec: resourceActionTarget(resource, action), target: { resource, action } };
    },
    handle: async ({ req, reqCtx, target: { resource, action }, params }) => {
      const { resource: name, id } = params;
      const row = await readLiveRow(config, resource, id, reqCtx);
      if (!row || !(await actionAppliesTo(action, row, reqCtx))) return rowNotFound();
      const disabled = action.disabled?.(row);
      if (disabled) {
        return actionFailure(
          "conflict",
          typeof disabled === "string" ? disabled : mergeLabels(config.labels).errors.notApplicable,
        );
      }

      const input = await readActionBody(req);
      if (input instanceof Response) return input;
      return runDeclaredAction(
        config,
        reqCtx,
        action,
        input,
        (parsed, actionCtx) => action.run(row, parsed, actionCtx),
        {
          audit: {
            action: `${name}.action.${action.key}`,
            resource: name,
            targetId: id,
            diff: async () =>
              auditDiff(config, resource, row, await readRow(config, resource, id, reqCtx), reqCtx),
            rows: new Map([[id, row]]),
          },
          resourceAudit: resource.options.audit,
          publish: { resourceName: name, pathname: buildHref(config, name) },
        },
      );
    },
  });
}
