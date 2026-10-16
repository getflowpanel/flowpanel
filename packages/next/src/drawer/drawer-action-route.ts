import type { ResolvedAdminConfig } from "@flowpanel/core";
import { actionAppliesTo, resourceActionTarget } from "../runtime/action-gate";
import { buildHref } from "../runtime/href";
import { readLiveRow, readRow } from "../runtime/read-row";
import {
  auditDiff,
  guardedRoute,
  lookupAction,
  readActionBody,
  rowNotFound,
  runDeclaredAction,
} from "../runtime/write-pipeline";
import { type DrawerTarget, lookupDrawer } from "./drawer-route";

/** POST /api/flowpanel/drawer/[resource]/[id]/actions/[action] */
export function drawerActionRoute(config: ResolvedAdminConfig) {
  return guardedRoute<
    { resource: string; id: string; action: string },
    DrawerTarget & { action: NonNullable<DrawerTarget["drawer"]["actions"]>[number] }
  >(config, {
    resolve: (params) => {
      const target = lookupDrawer(config, params.resource);
      if (target instanceof Response) return target;
      const action = lookupAction(target.drawer.actions, params.action);
      if (action instanceof Response) return action;
      return {
        spec: resourceActionTarget(target.resource, action),
        target: { ...target, action },
      };
    },
    handle: async ({
      req,
      reqCtx,
      target: { resource, action },
      params: { resource: name, id },
    }) => {
      const row = await readLiveRow(config, resource, id, reqCtx);
      if (!row || !(await actionAppliesTo(action, row, reqCtx))) return rowNotFound();
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
            action: `${name}.drawer.${action.key}`,
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
