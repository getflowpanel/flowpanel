import type { AccessContext, RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import {
  accessAllows,
  errorResult,
  FlowpanelError,
  reportUnexpectedError,
  resolveOperationAccess,
} from "@flowpanel/core";
import { encodeEnvelope } from "@flowpanel/core/publish";
import { bindPublisher, subscribe } from "./runtime/publish";
import { CHANNEL_PATTERN, channelResource } from "./runtime/realtime-channels";
import { buildRequestContext } from "./runtime/request-setup";

const HEARTBEAT_MS = 15_000;

const MAX_CHANNELS = 25;

export interface StreamOptions {
  heartbeatMs?: number;
}

/** Whether the caller may subscribe to `channel`. */
async function channelAllowed(
  channel: string,
  config: ResolvedAdminConfig,
  reqCtx: AccessContext,
): Promise<boolean> {
  if (!CHANNEL_PATTERN.test(channel)) return false;
  const resourceName = channelResource(channel);
  if (resourceName === null) return true;
  const resource = config.resourcesByName.get(resourceName);
  if (!resource) return false;
  return accessAllows(resolveOperationAccess(resource.options.access, "read"), reqCtx);
}

/**
 * What a subscriber receives. A tenant-scoped resource's event keeps only its `action`, so no row id
 * or row data crosses tenants; the admin's own subscribers only refresh, so they lose nothing.
 */
function deliverable(channel: string, config: ResolvedAdminConfig): (payload: unknown) => unknown {
  const name = channelResource(channel);
  const resource = name === null ? undefined : config.resourcesByName.get(name);
  if (typeof resource?.options.scope !== "function") return (payload) => payload;
  return (payload) =>
    typeof payload === "object" &&
    payload !== null &&
    "action" in payload &&
    typeof payload.action === "string"
      ? { action: payload.action }
      : {};
}

export function stream(
  config: ResolvedAdminConfig,
  opts: StreamOptions = {},
): (req: Request) => Promise<Response> {
  const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;

  return async function streamGET(req: Request): Promise<Response> {
    bindPublisher(config);

    let reqCtx: RequestContext;
    try {
      reqCtx = await buildRequestContext({ req, config });
    } catch (err) {
      // Preserve the real status: a crashing session provider is a 500, a rate limit a 429, not a silent 403.
      await reportUnexpectedError(
        err,
        {
          requestId: "stream",
          route: "stream",
          method: req.method,
          url: req.url,
          ip: null,
          userAgent: req.headers.get("user-agent"),
        },
        config.hooks?.onError,
      );
      const status = err instanceof FlowpanelError ? err.status : 500;
      return Response.json(errorResult(err, "stream"), { status });
    }

    const url = new URL(req.url);
    const requestedChannels = url.searchParams.getAll("channel");
    // Cap before the per-channel role check so a huge repeated ?channel= list can't force unbounded checks.
    const channels: string[] = [];
    for (const ch of requestedChannels.slice(0, MAX_CHANNELS)) {
      if (await channelAllowed(ch, config, reqCtx)) channels.push(ch);
    }
    const encoder = new TextEncoder();

    let disposers: Array<() => void> = [];
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    function cleanup(): void {
      if (closed) return;
      closed = true;
      for (const d of disposers) d();
      disposers = [];
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    }

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        function closeController(): void {
          try {
            controller.close();
          } catch {}
        }

        function safeEnqueue(chunk: string): void {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            cleanup();
            closeController();
          }
        }

        // Disconnected before the abort listener could attach — bail out now or subscriptions leak for good.
        if (req.signal?.aborted) {
          cleanup();
          closeController();
          return;
        }

        safeEnqueue("event: ready\ndata: {}\n\n");

        for (const ch of channels) {
          const shape = deliverable(ch, config);
          const dispose = subscribe(ch, (payload) => {
            safeEnqueue(`event: message\ndata: ${encodeEnvelope(ch, shape(payload))}\n\n`);
          });
          disposers.push(dispose);
        }

        heartbeat = setInterval(() => {
          safeEnqueue(": keep-alive\n\n");
        }, heartbeatMs);

        if (req.signal) {
          req.signal.addEventListener("abort", () => {
            cleanup();
            closeController();
          });
        }
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  };
}
