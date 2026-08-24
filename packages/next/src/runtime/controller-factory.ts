import type {
  AnyResourceConfig,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { createDashboardController } from "../controllers/dashboard-controller.js";
import {
  createResourceController,
  type ResourceController,
} from "../controllers/resource-controller.js";

type RowOf<Resource> =
  Resource extends ResourceConfig<infer _Ref, infer Row, infer _Options>
    ? Row
    : Record<string, unknown>;
type NameOf<Resource> = Resource extends { options: { name: infer Name extends string } }
  ? Name
  : string;

export type ResourceControllers<Resources extends readonly AnyResourceConfig[]> = {
  [Resource in Resources[number] as NameOf<Resource>]: ResourceController<
    RowOf<Resource> extends Record<string, unknown> ? RowOf<Resource> : Record<string, unknown>
  >;
};

export interface FlowpanelRequest<Resources extends readonly AnyResourceConfig[]> {
  readonly resources: ResourceControllers<Resources>;
  resource(name: string): ResourceController<Record<string, unknown>>;
  dashboard(path: string): ReturnType<typeof createDashboardController>;
  /** Request identity is intentionally not exposed; controllers are the authority boundary. */
  readonly requestId: string;
}

export function createControllerFactory<Resources extends readonly AnyResourceConfig[]>(
  config: ResolvedAdminConfig<Resources>,
  context: RequestContext,
): FlowpanelRequest<Resources> {
  const controllers: Record<string, ResourceController<Record<string, unknown>>> = {};
  for (const [name, resource] of config.resourcesByName) {
    controllers[name] = createResourceController(config, resource, context);
  }

  return Object.freeze({
    resources: Object.freeze(controllers) as ResourceControllers<Resources>,
    resource(name: string) {
      const controller = controllers[name];
      if (!controller) throw new Error(`Unknown Flowpanel resource: ${name}`);
      return controller;
    },
    dashboard(path: string) {
      return createDashboardController(config, context, path);
    },
    requestId: context.requestId ?? "unknown",
  });
}
