"use client";
import { formatLabel } from "@flowpanel/core/labels";
import { useApiBase, useLabels } from "@flowpanel/react";
import { ActionMenu, type RunnableAction } from "./ActionMenu";
import type { SerializedRowAction } from "./row-action";

export interface RowActionsMenuProps {
  resource: string;
  id: string;
  actions: SerializedRowAction[];
}

/** Where a row action posts, and what its toasts say. */
export function runnableRowAction(
  apiBase: string,
  resource: string,
  id: string,
  action: SerializedRowAction,
  failed: string,
  ran: string,
): RunnableAction {
  return {
    key: action.key,
    label: action.label,
    ...(action.icon ? { icon: action.icon } : {}),
    ...(action.variant ? { variant: action.variant } : {}),
    ...(action.placement ? { placement: action.placement } : {}),
    ...(action.confirm ? { confirm: action.confirm } : {}),
    ...(action.form ? { form: action.form } : {}),
    url: `${apiBase}/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/actions/${encodeURIComponent(action.key)}`,
    successMessage: formatLabel(ran, { label: action.label }),
    failureMessage: formatLabel(failed, { label: action.label }),
  };
}

export function RowActionsMenu({ resource, id, actions }: RowActionsMenuProps) {
  const labels = useLabels();
  const apiBase = useApiBase();
  return (
    <ActionMenu
      look="row"
      label={labels.table.rowActions}
      actions={actions.map((action) =>
        runnableRowAction(
          apiBase,
          resource,
          id,
          action,
          labels.errors.actionFailed,
          labels.actions.ran,
        ),
      )}
    />
  );
}
