"use client";
import type { ActionEmphasis } from "@flowpanel/core";
import { formatLabel } from "@flowpanel/core/labels";
import { Button, preloadAutoForm, useApiBase, useLabels } from "@flowpanel/react";
import Link from "next/link";
import type { SerializedDrawerAction } from "../drawer/drawer-action";
import type { RecordActions } from "../runtime/record-actions";
import { ActionMenu, type RunnableAction } from "./ActionMenu";
import { runnableRowAction } from "./RowActionsMenu";

export interface RecordActionsBarProps extends RecordActions {
  resource: string;
  id: string;
  editEmphasis?: ActionEmphasis;
  /** After a delete: the record page goes back to its list; the drawer closes. */
  afterDelete: "list" | (() => void);
  /** Runs after any other action succeeded. */
  onDone?: () => void;
  /** Small buttons, for the drawer's header. */
  dense?: boolean;
}

function runnableDrawerAction(
  apiBase: string,
  resource: string,
  id: string,
  action: SerializedDrawerAction,
  failed: string,
  ran: string,
): RunnableAction {
  return {
    ...runnableRowAction(apiBase, resource, id, action, failed, ran),
    key: `drawer:${action.key}`,
    url: `${apiBase}/drawer/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/actions/${encodeURIComponent(action.key)}`,
  };
}

/** A record's Edit button and its one menu of row actions, drawer actions and Delete, on its page and in its drawer. */
export function RecordActionsBar({
  resource,
  id,
  rowActions,
  drawerActions,
  editHref,
  editEmphasis,
  delete: deletion,
  afterDelete,
  onDone,
  dense,
}: RecordActionsBarProps) {
  const apiBase = useApiBase();
  const labels = useLabels();
  const actions: RunnableAction[] = [
    ...rowActions.map((action) =>
      runnableRowAction(
        apiBase,
        resource,
        id,
        action,
        labels.errors.actionFailed,
        labels.actions.ran,
      ),
    ),
    ...drawerActions.map((action) =>
      runnableDrawerAction(
        apiBase,
        resource,
        id,
        action,
        labels.errors.actionFailed,
        labels.actions.ran,
      ),
    ),
  ];
  if (deletion) {
    actions.push({
      key: "delete",
      label: deletion.label,
      variant: "destructive",
      confirm: {
        title: deletion.title,
        description: deletion.description,
        confirmLabel: deletion.label,
      },
      url: `${apiBase}/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
      method: "DELETE",
      successMessage: deletion.successMessage,
      failureMessage: formatLabel(labels.errors.actionFailed, { label: deletion.label }),
      separated: true,
      ...(afterDelete === "list" ? { redirectTo: deletion.listHref } : { onSuccess: afterDelete }),
    });
  }
  const edit = editHref ? (
    <Button
      asChild
      variant={editEmphasis === "primary" ? "default" : "outline"}
      {...(dense ? { size: "sm" as const } : {})}
    >
      <Link
        href={editHref}
        prefetch={false}
        onPointerEnter={preloadAutoForm}
        onFocus={preloadAutoForm}
      >
        {labels.actions.edit}
      </Link>
    </Button>
  ) : null;
  return (
    <ActionMenu
      look="header"
      label={labels.actions.more}
      actions={actions}
      leading={edit}
      {...(onDone ? { onDone } : {})}
      {...(dense ? { dense } : {})}
    />
  );
}
