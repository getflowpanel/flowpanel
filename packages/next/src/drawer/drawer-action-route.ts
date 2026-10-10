import type { ResolvedAdminConfig } from "@flowpanel/core";
import { buildHref } from "../runtime/href";
import { readRow } from "../runtime/read-row";
import {
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
        spec: { resource: target.resource, actionAccess: action.access },
        target: { ...target, action },
      };
    },
    handle: async ({
      req,
      reqCtx,
      target: { resource, action },
      params: { resource: name, id },
    }) => {
      const row = await readRow(config, resource, id, reqCtx);
      if (!row) return rowNotFound();
      if (action.when && !(await action.when({ ...reqCtx, current: row, input: {} }))) {
        return rowNotFound();
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
          audit: { action: `${name}.drawer.${action.key}`, resource: name, targetId: id },
          resourceAudit: resource.options.audit,
          publish: { resourceName: name, pathname: buildHref(config, name) },
        },
      );
    },
  });
}
