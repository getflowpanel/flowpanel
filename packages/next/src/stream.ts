import type { AccessContext, RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import {
  accessAllows,
  errorResult,
  FlowpanelError,
  FlowpanelRateLimitError,
  reportUnexpectedError,
  resolveOperationAccess,
} from "@flowpanel/core";
import { encodeEnvelope } from "@flowpanel/core/publish";
import { actorIdFromSession } from "./runtime/action-helpers";
import { bindPublisher, subscribe } from "./runtime/publish";
import { CHANNEL_PATTERN, channelResource } from "./runtime/realtime-channels";
import { buildRequestContext } from "./runtime/request-setup";
import { withRetryAfter } from "./runtime/retry-after";

const HEARTBEAT_MS = 15_000;
const MAX_CHANNELS = 25;
const MAX_STREAMS_PER_ACTOR = 10;
const MAX_AGE_MS = 15 * 60_000;

export interface StreamOptions {
  heartbeatMs?: number;
  /** Open streams one user (or, without a user id, one IP) may hold at once. Default 10. */
  maxPerActor?: number;
  /** A stream closes after this long, so the browser reconnects through auth again. Default 15 minutes. */
  maxAgeMs?: number;
}

const warned = new Set<string>();

function warnUndeclared(channel: string): void {
  if (process.env.NODE_ENV === "production" || warned.has(channel)) return;
  warned.add(channel);
  console.warn(
    `[flowpanel] stream: refused channel "${channel}", which realtime.channels does not declare. ` +
      `Add realtime: { channels: { "${channel}": {} } }.`,
  );
}

function declaredChannel(config: ResolvedAdminConfig, channel: string) {
  const channels = config.realtime?.channels;
  return channels && Object.hasOwn(channels, channel) ? channels[channel] : undefined;
}

/** Whether the caller may subscribe to `channel`. */
async function channelAllowed(
  channel: string,
  config: ResolvedAdminConfig,
  reqCtx: AccessContext,
): Promise<boolean> {
  if (!CHANNEL_PATTERN.test(channel)) return false;
  const resourceName = channelResource(channel);
  if (resourceName !== null) {
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) return false;
    return accessAllows(resolveOperationAccess(resource.options.access, "read"), reqCtx);
  }
  const declared = declaredChannel(config, channel);
  if (!declared) {
    warnUndeclared(channel);
    return false;
  }
  return declared.access === undefined || accessAllows(declared.access, reqCtx);
}

function actionOnly(payload: unknown): unknown {
  return typeof payload === "object" &&
    payload !== null &&
    "action" in payload &&
    typeof payload.action === "string"
    ? { action: payload.action }
    : {};
}

/**
 * What a subscriber receives. A tenant-scoped resource's event keeps only its `action`, so no row id
 * or row data crosses tenants; under an admin-wide `scope`, one of your own channels sends `{}`
 * unless it is declared `tenantSafe`.
 */
function deliverable(channel: string, config: ResolvedAdminConfig): (payload: unknown) => unknown {
  const name = channelResource(channel);
  if (name !== null) {
    const resource = config.resourcesByName.get(name);
    return typeof resource?.options.scope === "function" ? actionOnly : (payload) => payload;
  }
  if (!config.scope || declaredChannel(config, channel)?.tenantSafe === true) {
    return (payload) => payload;
  }
  return () => ({});
}

const openStreams = new Map<string, number>();

/** Counts one open stream for `key`; `null` when the actor already holds the most allowed. */
function claimStream(key: string | null, max: number): (() => void) | null {
  if (key === null) return () => {};
  const open = openStreams.get(key) ?? 0;
  if (open >= max) return null;
  openStreams.set(key, open + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (openStreams.get(key) ?? 1) - 1;
    if (left > 0) openStreams.set(key, left);
    else openStreams.delete(key);
  };
}

export function stream(
  config: ResolvedAdminConfig,
  opts: StreamOptions = {},
): (req: Request) => Promise<Response> {
  const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;
  const maxPerActor = opts.maxPerActor ?? MAX_STREAMS_PER_ACTOR;
  const maxAgeMs = opts.maxAgeMs ?? MAX_AGE_MS;

  return async function streamGET(req: Request): Promise<Response> {
    bindPublisher(config);

    const report = (err: unknown, requestId: string) =>
      reportUnexpectedError(
        err,
        {
          requestId,
          route: "stream",
          method: req.method,
          url: req.url,
          ip: null,
          userAgent: req.headers.get("user-agent"),
        },
        config.hooks?.onError,
      );
    // Preserve the real status: a crashing session provider is a 500, a rate limit a 429, not a silent 403.
    const failed = async (err: unknown, requestId: string): Promise<Response> => {
      await report(err, requestId);
      const status = err instanceof FlowpanelError ? err.status : 500;
      return withRetryAfter(Response.json(errorResult(err, requestId), { status }), config);
    };

    let reqCtx: RequestContext;
    const channels: string[] = [];
    const refused: string[] = [];
    try {
      reqCtx = await buildRequestContext({ req, config });
    } catch (err) {
      return failed(err, "stream");
    }
    const requested = new URL(req.url).searchParams.getAll("channel");
    // Cap before the per-channel role check so a huge repeated ?channel= list can't force unbounded checks.
    for (const ch of requested.slice(0, MAX_CHANNELS)) {
      let allowed = false;
      try {
        allowed = await channelAllowed(ch, config, reqCtx);
      } catch (err) {
        await report(err, reqCtx.requestId ?? "stream");
      }
      (allowed ? channels : refused).push(ch);
    }

    const actor = actorIdFromSession(reqCtx.session, config.auth.userId);
    const release = claimStream(
      actor !== null ? `user:${actor}` : reqCtx.ip ? `ip:${reqCtx.ip}` : null,
      maxPerActor,
    );
    if (release === null) {
      const err = new FlowpanelRateLimitError("Too many open streams");
      return Response.json(errorResult(err, reqCtx.requestId ?? "stream"), { status: err.status });
    }

    const encoder = new TextEncoder();

    let disposers: Array<() => void> = [];
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let expiry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function cleanup(): void {
      if (closed) return;
      closed = true;
      release?.();
      for (const d of disposers) d();
      disposers = [];
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      if (expiry) {
        clearTimeout(expiry);
        expiry = null;
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

        safeEnqueue("retry: 1000\nevent: ready\ndata: {}\n\n");
        if (refused.length > 0) {
          safeEnqueue(`event: refused\ndata: ${JSON.stringify({ channels: refused })}\n\n`);
        }

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
        // Ending the response makes EventSource reconnect, which runs auth and access again.
        expiry = setTimeout(() => {
          // `closing` tells the browser's live badge this end is planned, so it reconnects quietly.
          safeEnqueue("event: closing\ndata: {}\n\n");
          cleanup();
          closeController();
        }, maxAgeMs);

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
