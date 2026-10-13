import type { DrawerConfig, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { actionFailure } from "../runtime/action-failure";
import { rowVisibility, withSoftDeleteColumn } from "../runtime/deleted-row";
import { declaredDrawerRowFields, selectKnownFields } from "../runtime/project-row";
import { readRow } from "../runtime/read-row";
import { resolveReadableFieldSet } from "../runtime/readable-fields";
import { guardedRoute, lookupResource, rowNotFound } from "../runtime/write-pipeline";
import { buildDrawerPayload } from "./drawer-payload";

export type {
  DrawerPayload,
  SerializedDrawerAction,
  SerializedDrawerTab,
  SerializedWidget,
} from "./drawer-payload";

export interface DrawerRouteCtx {
  params: Promise<{ resource: string; id: string }>;
}

export interface DrawerTarget {
  resource: ResourceConfig;
  drawer: DrawerConfig;
}

/** The resource a drawer URL names and its drawer config, or the answer when either is missing. */
export function lookupDrawer(config: ResolvedAdminConfig, name: string): DrawerTarget | Response {
  const resource = lookupResource(config, name);
  if (resource instanceof Response) return resource;
  const drawer = resource.options.drawer;
  if (!drawer) return actionFailure("bad_request", `resource "${name}" has no drawer config`);
  return { resource, drawer };
}

/** GET /api/flowpanel/drawer/[resource]/[id] — the drawer's payload for one row. */
export function drawerRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ resource: string; id: string }, DrawerTarget>(config, {
    write: false,
    resolve: (params) => {
      const target = lookupDrawer(config, params.resource);
      if (target instanceof Response) return target;
      return { spec: { resource: target.resource, operation: "read" }, target };
    },
    handle: async ({
      req,
      reqCtx,
      target: { resource, drawer },
      params: { resource: name, id },
    }) => {
      const readable = await resolveReadableFieldSet(
        declaredDrawerRowFields(resource),
        resource.options.fieldAccess,
        reqCtx,
      );
      const select = selectKnownFields(readable, config.adapter.introspect(resource.ref).columns);
      const row = await readRow(
        config,
        resource,
        id,
        reqCtx,
        withSoftDeleteColumn(resource, select),
      );
      const visibility = row ? await rowVisibility(resource, row, reqCtx) : "hidden";
      if (!row || visibility === "hidden") return rowNotFound();
      return Response.json(
        await buildDrawerPayload({
          config,
          resource,
          drawer,
          name,
          id,
          row,
          readable,
          reqCtx,
          req,
          deleted: visibility === "deleted",
        }),
      );
    },
  });
}
