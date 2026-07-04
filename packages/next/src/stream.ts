import type { ResolvedAdminConfig, ResourceConfig, Session } from "@flowpanel/core";
import { checkRequireRole } from "@flowpanel/core";
import { bindPublisher, subscribe } from "./runtime/publish.js";

const HEARTBEAT_MS = 15_000;

const MAX_CHANNELS = 25;
const CHANNEL_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

export interface StreamOptions {
  heartbeatMs?: number;
}

/** Whether `session`/the caller's role may subscribe to `channel`. */
function channelAllowed(
  channel: string,
  config: ResolvedAdminConfig,
  session: Session | null,
): boolean {
  if (!CHANNEL_PATTERN.test(channel)) return false;
  const resourceName = channel.startsWith("resource.") ? channel.slice("resource.".length) : null;
  if (resourceName === null) return true;
  const resource: ResourceConfig | undefined = config.resourcesByName.get(resourceName);
  if (!resource || resource.options.requireRole === undefined) return true;
  try {
    checkRequireRole(resource.options.requireRole, config.auth.role(session), session);
    return true;
  } catch {
    return false;
  }
}

export function stream(
  config: ResolvedAdminConfig,
  opts: StreamOptions = {},
): (req: Request) => Promise<Response> {
  const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;

  return async function streamGET(req: Request): Promise<Response> {
    bindPublisher(config);

    const session = await config.auth.session();
    const role = config.auth.role(session);
    try {
      checkRequireRole(config.auth.requireRole, role, session);
    } catch {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const requestedChannels = url.searchParams.getAll("channel");
    const channels = requestedChannels
      .filter((ch) => channelAllowed(ch, config, session))
      .slice(0, MAX_CHANNELS);
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
        function safeEnqueue(chunk: string): void {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            cleanup();
          }
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
            try {
              controller.close();
            } catch {}
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
