import type { AccessContext, RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import {
  accessAllows,
  checkRequireRole,
  errorResult,
  FlowpanelError,
  reportUnexpectedError,
  resolveOperationAccess,
} from "@flowpanel/core";
import { bindPublisher, subscribe } from "./runtime/publish";
import { buildRequestContext } from "./runtime/request-setup";

const HEARTBEAT_MS = 15_000;

const MAX_CHANNELS = 25;
const CHANNEL_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

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
  const resourceName = channel.startsWith("resource.") ? channel.slice("resource.".length) : null;
  if (resourceName === null) return true;
  const resource = config.resourcesByName.get(resourceName);
  if (!resource) return true;
  return accessAllows(
    resolveOperationAccess(resource.options.access, resource.options.requireRole, "read"),
    reqCtx,
  );
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
      checkRequireRole(config.auth.requireRole, reqCtx.role, reqCtx.session);
    } catch (err) {
      // Preserve the real status: a crashing session provider is a 500 and a
      // rate limit is a 429, not a silent 403.
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
    // Cap before the per-channel role check so a huge repeated ?channel= list can't force
    // MAX_CHANNELS-unbounded role checks.
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

        // Disconnected during `await config.auth.session()`, before the abort listener below
        // could attach — bail out now or the heartbeat/subscriptions leak for good.
        if (req.signal?.aborted) {
          cleanup();
          closeController();
          return;
        }

        safeEnqueue("event: ready\ndata: {}\n\n");

        for (const ch of channels) {
          const dispose = subscribe(ch, (payload) => {
            const envelope = payload === undefined ? { channel: ch } : { channel: ch, payload };
            safeEnqueue(`event: message\ndata: ${JSON.stringify(envelope)}\n\n`);
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
