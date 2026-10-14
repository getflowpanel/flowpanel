import type {
  BulkAction,
  RequestContext,
  ResolvedLabels,
  ResourceConfig,
  RowAction,
} from "@flowpanel/core";
import { type SerializedBulkAction, serializeBulkAction } from "../actions/bulk-action";
import { type SerializedRowAction, serializeRowAction } from "../actions/row-action";
import { actionAppliesTo, offeredActions, resourceActionTarget } from "../runtime/action-gate";
import { rowIdentity } from "../runtime/row-identity";

export interface ResourceListActions {
  rowActions: SerializedRowAction[];
  /** Present only when an action depends on the row, or a row is deleted and offers none. */
  rowActionsById?: Record<string, SerializedRowAction[]>;
  bulkActions: SerializedBulkAction[];
}

async function visibleByRow<Row extends Record<string, unknown>>(
  actions: RowAction<Row>[],
  serialized: SerializedRowAction[],
  rows: Row[],
  rowKey: string,
  reqCtx: RequestContext,
  deleted: ReadonlySet<string>,
): Promise<Record<string, SerializedRowAction[]>> {
  const entries = await Promise.all(
    rows.map(async (row) => {
      const id = rowIdentity(row, rowKey);
      if (id === null) return null;
      const visible: SerializedRowAction[] = [];
      if (deleted.has(id)) return [id, visible] as const;
      for (const [i, action] of actions.entries()) {
        if (!(await actionAppliesTo(action, row, reqCtx))) continue;
        const entry = serialized[i];
        if (entry) visible.push(entry);
      }
      return [id, visible] as const;
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/** The row and bulk actions this caller's routes would accept, wire-safe and per-row where needed. */
export async function resolveResourceListActions<Row extends Record<string, unknown>>(
  resource: ResourceConfig,
  rows: Row[],
  rowKey: string,
  reqCtx: RequestContext,
  labels: ResolvedLabels,
  deleted: ReadonlySet<string> = new Set(),
): Promise<ResourceListActions> {
  const target = (action: { key: string; access?: RowAction<Row>["access"] }) =>
    resourceActionTarget(resource, action);
  const rawActions = await offeredActions(
    resource.options.actions as RowAction<Row>[] | undefined,
    target,
    reqCtx,
  );
  const rowActions = rawActions.map(serializeRowAction);
  const rawBulkActions = await offeredActions(
    resource.options.bulkActions as BulkAction<Row>[] | undefined,
    target,
    reqCtx,
  );
  const perRow = deleted.size > 0 || rawActions.some((action) => action.hidden || action.when);
  return {
    rowActions,
    bulkActions: rawBulkActions.map((a) => serializeBulkAction(a, labels, resource)),
    ...(perRow
      ? {
          rowActionsById: await visibleByRow(rawActions, rowActions, rows, rowKey, reqCtx, deleted),
        }
      : {}),
  };
}
