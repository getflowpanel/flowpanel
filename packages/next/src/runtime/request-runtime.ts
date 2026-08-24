import type { AnyResourceConfig, ResolvedAdminConfig } from "@flowpanel/core";
import { cache } from "react";
import { buildServerRequest } from "./build-server-request.js";
import { createControllerFactory, type FlowpanelRequest } from "./controller-factory.js";
import { buildRequestContext } from "./request-setup.js";

export function createRequestRuntime<Resources extends readonly AnyResourceConfig[]>(
  config: ResolvedAdminConfig<Resources>,
): () => Promise<FlowpanelRequest<Resources>> {
  return cache(async () => {
    const request = await buildServerRequest(`http://localhost${config.paths.admin}`);
    const context = await buildRequestContext({ req: request, config });
    return createControllerFactory(config, context);
  });
}
