import type { BulkAction, RequestContext, ResourceConfig, RowAction } from "@flowpanel/core";
import { type SerializedBulkAction, serializeBulkAction } from "../actions/bulk-action";
import { type SerializedRowAction, serializeRowAction } from "../actions/row-action";
import { filterActionsByAccess } from "../runtime/action-helpers";
import { rowIdentity } from "../runtime/row-identity";

export interface ResourceListActions {
  rowActions: SerializedRowAction[];
  /** Present only when some action hides itself per row. */
  rowActionsById?: Record<string, SerializedRowAction[]>;
  bulkActions: SerializedBulkAction[];
}

async function visibleByRow<Row extends Record<string, unknown>>(
  actions: RowAction<Row>[],
  serialized: SerializedRowAction[],
  rows: Row[],
  rowKey: string,
  reqCtx: RequestContext,
): Promise<Record<string, SerializedRowAction[]>> {
  const entries = await Promise.all(
    rows.map(async (row) => {
      const id = rowIdentity(row, rowKey);
      if (id === null) return null;
      const visible: SerializedRowAction[] = [];
      for (const [i, action] of actions.entries()) {
        if (action.hidden && (await action.hidden(row, reqCtx))) continue;
        const entry = serialized[i];
        if (entry) visible.push(entry);
      }
      return [id, visible] as const;
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/** The row and bulk actions this caller may run, wire-safe and per-row where needed. */
export async function resolveResourceListActions<Row extends Record<string, unknown>>(
  resource: ResourceConfig,
  rows: Row[],
  rowKey: string,
  reqCtx: RequestContext,
): Promise<ResourceListActions> {
  const rawActions = await filterActionsByAccess(
    resource.options.actions as RowAction<Row>[] | undefined,
    reqCtx,
  );
  const rowActions = rawActions?.map(serializeRowAction) ?? [];
  const rawBulkActions = await filterActionsByAccess(
    resource.options.bulkActions as BulkAction<Row>[] | undefined,
    reqCtx,
  );
  return {
    rowActions,
    bulkActions: rawBulkActions?.map(serializeBulkAction) ?? [],
    ...(rawActions?.some((action) => action.hidden)
      ? {
          rowActionsById: await visibleByRow(rawActions, rowActions, rows, rowKey, reqCtx),
        }
      : {}),
  };
}
