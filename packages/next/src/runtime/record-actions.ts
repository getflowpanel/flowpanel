import type {
  RequestContext,
  ResolvedAdminConfig,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import {
  accessAllows,
  formatCount,
  mergeLabels,
  resolveFormatting,
  resolveOperationAccess,
} from "@flowpanel/core";
import type { SerializedRowAction } from "../actions/row-action";
import { type SerializedDrawerAction, serializeDrawerAction } from "../drawer/drawer-action";
import { resolveResourceListActions } from "../pages/resource-list-actions";
import { filterActionsByAccess } from "./action-helpers";
import { buildHref } from "./href";
import { readRow } from "./read-row";
import { singularTitle } from "./resource-title";
import { rowIdentity, rowKeyOf } from "./row-identity";

/** A record's Delete as its page and drawer offer it. */
export interface RecordDelete {
  label: string;
  title: string;
  description: string;
  successMessage: string;
  /** Where the record page goes once the row is gone. */
  listHref: string;
}

/** What a record's header menu holds for this caller: the row's own actions, Edit and Delete. */
export interface RecordActions {
  rowActions: SerializedRowAction[];
  /** The resource's `drawer.actions`, offered on the record page as well as in the drawer. */
  drawerActions: SerializedDrawerAction[];
  editHref: string | null;
  delete: RecordDelete | null;
}

/** The text under one record's Delete confirm: `delete.confirm` worded for one, or the default copy. */
function deleteConfirmFor(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  soft: boolean,
  labels: ResolvedLabels,
): string {
  const confirm = resource.options.delete?.confirm;
  if (confirm === undefined) {
    return soft ? labels.confirm.softDeleteDescription : labels.confirm.deleteDescription;
  }
  return formatCount(confirm, 1, resolveFormatting(config.formatting).locale);
}

/** `drawer.actions` this caller may run on this row: `access`, then `when` on the row the action route reads. */
async function offeredDrawerActions(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  id: string,
  reqCtx: RequestContext,
): Promise<SerializedDrawerAction[]> {
  const allowed = await filterActionsByAccess(resource.options.drawer?.actions, reqCtx);
  const row = allowed.some((action) => action.when)
    ? await readRow(config, resource, id, reqCtx)
    : null;
  const offered = await Promise.all(
    allowed.map(async (action) => {
      if (!action.when) return action;
      return row && (await action.when({ ...reqCtx, current: row, input: {} })) ? action : null;
    }),
  );
  return offered.filter((action) => action !== null).map(serializeDrawerAction);
}

function allows(
  resource: ResourceConfig,
  operation: "update" | "delete",
  reqCtx: RequestContext,
): Promise<boolean> {
  if (resource.options[operation]?.disabled) return Promise.resolve(false);
  return accessAllows(resolveOperationAccess(resource.options.access, operation), reqCtx);
}

/** The list's row actions for this row plus drawer actions, Edit and Delete the caller may run; none on a deleted row. */
export async function recordActions(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  name: string,
  id: string,
  row: Record<string, unknown>,
  reqCtx: RequestContext,
  deleted: boolean,
): Promise<RecordActions> {
  if (deleted) return { rowActions: [], drawerActions: [], editHref: null, delete: null };
  const labels = mergeLabels(config.labels);
  const [listed, drawerActions, canEdit, canDelete] = await Promise.all([
    resolveResourceListActions(resource, [row], rowKeyOf(resource), reqCtx, labels),
    offeredDrawerActions(config, resource, id, reqCtx),
    config.readOnly ? Promise.resolve(false) : allows(resource, "update", reqCtx),
    config.readOnly ? Promise.resolve(false) : allows(resource, "delete", reqCtx),
  ]);
  const soft = resource.options.delete?.softDelete !== undefined;
  return {
    rowActions: listed.rowActionsById
      ? (listed.rowActionsById[rowIdentity(row, rowKeyOf(resource)) ?? id] ?? [])
      : listed.rowActions,
    drawerActions,
    editHref: canEdit ? buildHref(config, name, id, "edit") : null,
    delete: canDelete
      ? {
          label: labels.actions.delete,
          title: singularTitle(labels.confirm.deleteTitle, resource, name),
          description: deleteConfirmFor(config, resource, soft, labels),
          successMessage: singularTitle(labels.saving.deleted, resource, name),
          listHref: buildHref(config, name),
        }
      : null,
  };
}
