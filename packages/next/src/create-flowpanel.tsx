import type { AdminDefinition, AnyResourceConfig, ResolvedAdminConfig } from "@flowpanel/core";
import { createPublisher, defineAdmin } from "@flowpanel/core";
import { Flowpanel } from "./flowpanel-page.js";
import { handlers as createHandlers, type FlowpanelHandlers } from "./handlers.js";
import type { FlowpanelRequest } from "./runtime/controller-factory.js";
import { createRequestRuntime } from "./runtime/request-runtime.js";
import {
  type FlowpanelClientMetadata,
  serializeClientMetadata,
  toWireValue,
} from "./wire/serialize.js";

export interface FlowpanelRuntime<Resources extends readonly AnyResourceConfig[]> {
  readonly page: ReturnType<typeof Flowpanel>;
  readonly handlers: FlowpanelHandlers;
  request(): Promise<FlowpanelRequest<Resources>>;
  readonly client: FlowpanelClientMetadata;
  readonly events: {
    publish(channel: string, payload?: unknown): Promise<void>;
  };
  dispose(): Promise<void>;
}

function isResolved<Resources extends readonly AnyResourceConfig[]>(
  definition: AdminDefinition<Resources> | ResolvedAdminConfig<Resources>,
): definition is ResolvedAdminConfig<Resources> {
  return "__resolved" in definition && definition.__resolved === true;
}

const CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_EVENT_BYTES = 64 * 1024;

/** Bind one typed admin definition to all supported Next.js runtime surfaces. */
export function createFlowpanel<const Resources extends readonly AnyResourceConfig[]>(
  definition: AdminDefinition<Resources> | ResolvedAdminConfig<Resources>,
): FlowpanelRuntime<Resources> {
  const config = isResolved(definition) ? definition : defineAdmin(definition);
  const request = createRequestRuntime(config);
  const publisher = createPublisher(config.realtime ?? { driver: "memory" });
  const namespace = config.id ?? "local";
  let disposed = false;

  return Object.freeze({
    page: Flowpanel(config),
    handlers: createHandlers(config),
    request,
    client: serializeClientMetadata(config),
    events: Object.freeze({
      async publish(channel: string, payload?: unknown) {
        if (disposed) throw new Error("This Flowpanel runtime has been disposed.");
        if (!CHANNEL.test(channel)) throw new Error("Invalid Flowpanel event channel.");
        const wirePayload = payload === undefined ? undefined : toWireValue(payload, "payload");
        if (wirePayload !== undefined) {
          const bytes = new TextEncoder().encode(JSON.stringify(wirePayload)).byteLength;
          if (bytes > MAX_EVENT_BYTES) throw new Error("Flowpanel event payload exceeds 64 KiB.");
        }
        await publisher.publish(`${namespace}:${channel}`, wirePayload);
      },
    }),
    async dispose() {
      if (disposed) return;
      disposed = true;
    },
  });
}
