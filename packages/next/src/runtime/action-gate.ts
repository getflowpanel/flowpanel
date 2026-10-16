import type {
  AccessRule,
  DashboardConfig,
  FieldWriteContext,
  RequestContext,
  ResourceConfig,
  ResourceOperation,
} from "@flowpanel/core";
import { accessAllows, requireAccess, resolveOperationAccess } from "@flowpanel/core";
import { isBuiltinBulkDelete } from "@flowpanel/core/internal";

/** The access rules a route's target sets. */
export interface TargetAccess {
  resource?: ResourceConfig | undefined;
  pageAccess?: AccessRule | undefined;
  actionAccess?: AccessRule | undefined;
  operation?: ResourceOperation | undefined;
}

interface GatedAction {
  key: string;
  access?: AccessRule | undefined;
}

/** Every rule the caller must pass: the action's own `access`, else the resource's `update` rule, plus the page's. */
function targetRules(target: TargetAccess): AccessRule[] {
  const rules: AccessRule[] = [];
  if (target.resource) {
    const operation =
      target.operation ?? (target.actionAccess !== undefined ? undefined : "update");
    const rule = operation && resolveOperationAccess(target.resource.options.access, operation);
    if (rule !== undefined) rules.push(rule);
  }
  if (target.pageAccess !== undefined) rules.push(target.pageAccess);
  if (target.actionAccess !== undefined) rules.push(target.actionAccess);
  return rules;
}

/** The route's gate: throws the access error for the first rule the caller fails. */
export async function requireTargetRules(
  target: TargetAccess,
  reqCtx: RequestContext,
): Promise<void> {
  for (const rule of targetRules(target)) await requireAccess(rule, reqCtx);
}

/** The menu's question, answered by the same rules the route enforces. */
export async function targetAllows(target: TargetAccess, reqCtx: RequestContext): Promise<boolean> {
  for (const rule of targetRules(target)) {
    if (!(await accessAllows(rule, reqCtx))) return false;
  }
  return true;
}

/** The list's Export: the resource's `read` rule and `export.access`. */
export function exportTarget(resource: ResourceConfig): TargetAccess {
  const options = resource.options.export;
  return { resource, operation: "read", actionAccess: options ? options.access : undefined };
}

/** A row, bulk or drawer action of `resource`; the built-in bulk Delete answers to `access.delete`. */
export function resourceActionTarget(resource: ResourceConfig, action: GatedAction): TargetAccess {
  return {
    resource,
    actionAccess: action.access,
    ...(isBuiltinBulkDelete(action) ? { operation: "delete" as const } : {}),
  };
}

export function dashboardActionTarget(
  dashboard: Pick<DashboardConfig, "access">,
  action: GatedAction,
): TargetAccess {
  return { pageAccess: dashboard.access, actionAccess: action.access };
}

/** The actions whose route would let this caller in. */
export async function offeredActions<Action extends GatedAction>(
  actions: readonly Action[] | undefined,
  targetOf: (action: Action) => TargetAccess,
  reqCtx: RequestContext,
): Promise<Action[]> {
  const offered: Action[] = [];
  for (const action of actions ?? []) {
    if (await targetAllows(targetOf(action), reqCtx)) offered.push(action);
  }
  return offered;
}

interface RowCondition<Row> {
  hidden?: ((row: Row, ctx: RequestContext) => boolean | Promise<boolean>) | undefined;
  when?: ((context: FieldWriteContext<Row>) => boolean | Promise<boolean>) | undefined;
}

/** Whether an action applies to this live row: its `when` holds and `hidden` does not hide it. */
export async function actionAppliesTo<Row>(
  action: RowCondition<Row>,
  row: Row,
  reqCtx: RequestContext,
): Promise<boolean> {
  if (action.when && !(await action.when({ ...reqCtx, current: row, input: {} }))) return false;
  return !(action.hidden && (await action.hidden(row, reqCtx)));
}

/** A dashboard's actions its header offers this caller. */
export function offeredDashboardActions<Action extends GatedAction>(
  dashboard: Pick<DashboardConfig, "access"> & { actions?: readonly Action[] | undefined },
  reqCtx: RequestContext,
): Promise<Action[]> {
  return offeredActions(
    dashboard.actions,
    (action) => dashboardActionTarget(dashboard, action),
    reqCtx,
  );
}
