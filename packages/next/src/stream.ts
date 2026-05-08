import type { ResolvedAdminConfig } from "@flowpanel/core";
import { bindPublisher, subscribe } from "./runtime/publish.js";

const HEARTBEAT_MS = 15_000;

export interface StreamOptions {
  heartbeatMs?: number;
}

export function stream(
  config: ResolvedAdminConfig,
  opts: StreamOptions = {},
): (req: Request) => Promise<Response> {
  const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;

  return async function streamGET(req: Request): Promise<Response> {
    bindPublisher(config);
    const url = new URL(req.url);
    const channels = url.searchParams.getAll("channel");
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

        // Ready handshake
        safeEnqueue("event: ready\ndata: {}\n\n");

        // Subscribe per channel
        for (const ch of channels) {
          const dispose = subscribe(ch, (payload) => {
            const data = payload === undefined ? "" : JSON.stringify(payload);
            safeEnqueue(`event: message\ndata: ${data}\n\n`);
          });
          disposers.push(dispose);
        }

        // Heartbeat (SSE comment line; proxies/nginx need it to keep the conn open)
        heartbeat = setInterval(() => {
          safeEnqueue(": keep-alive\n\n");
        }, heartbeatMs);

        // Abort handling
        if (req.signal) {
          req.signal.addEventListener("abort", () => {
            cleanup();
            try {
              controller.close();
            } catch {
              // already closed
            }
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
