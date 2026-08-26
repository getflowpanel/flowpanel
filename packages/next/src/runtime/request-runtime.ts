import type { AnyResourceConfig, ResolvedAdminConfig } from "@flowpanel/core";
import { cache } from "react";
import { buildServerRequest } from "./build-server-request";
import { createControllerFactory, type FlowpanelRequest } from "./controller-factory";
import { buildRequestContext } from "./request-setup";

export function createRequestRuntime<Resources extends readonly AnyResourceConfig[]>(
  config: ResolvedAdminConfig<Resources>,
): () => Promise<FlowpanelRequest<Resources>> {
  return cache(async () => {
    const request = await buildServerRequest(`http://localhost${config.paths.admin}`);
    const context = await buildRequestContext({ req: request, config });
    return createControllerFactory(config, context);
  });
}
