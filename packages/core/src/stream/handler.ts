/**
 * createFlowPanelStreamHandler — standalone SSE route handler.
 *
 * SSE does not belong in tRPC. tRPC's fetchRequestHandler JSON-wraps every
 * procedure result, so returning a streaming `Response` from a query would
 * reach the client as `{"result":{"data":{}}}` — not text/event-stream.
 *
 * Mount this as a separate Next.js App Router route:
 *
 *   // app/api/flowpanel/stream/route.ts
 *   import { createFlowPanelStreamHandler } from "@flowpanel/core";
 *   import { flowpanel } from "@/flowpanel";
 *   export const { GET } = createFlowPanelStreamHandler(flowpanel);
 *   export const dynamic = "force-dynamic";
 *   export const runtime = "nodejs";
 *
 * Auth runs via `config.security.auth.getSession(req)`. A missing/null
 * session → 401. Capacity is enforced against `config.ui.stream.maxConnections`
 * (default 50) → 429 when full.
 */

import type { FlowPanel, FlowPanelRouterConfig } from "../defineFlowPanel";
import { getOrCreateBroker, type SseEvent } from "../sse/broker";

export interface FlowPanelStreamHandlerOptions {
  /** Override the endpoint path used in error hints. Default "/api/flowpanel/stream". */
  endpoint?: string;
}

export type FlowPanelStreamHandler = (req: Request) => Response | Promise<Response>;

export function createFlowPanelStreamHandler(
  // biome-ignore lint/suspicious/noExplicitAny: FlowPanel<TConfig> — TConfig is invariant here
  flowpanel: Pick<FlowPanel<any>, "getRouterConfig">,
  _options: FlowPanelStreamHandlerOptions = {},
): { GET: FlowPanelStreamHandler } {
  const routerConfig: FlowPanelRouterConfig = flowpanel.getRouterConfig();
  const { config, getDb } = routerConfig;

  const GET: FlowPanelStreamHandler = async (req) => {
    // --- Auth ------------------------------------------------------------
    const getSession = config.security?.auth?.getSession;
    if (!getSession) {
      return new Response("Stream route requires security.auth.getSession in FlowPanel config", {
        status: 500,
      });
    }
    const session = await getSession(req);
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    // --- Capacity --------------------------------------------------------
    // biome-ignore lint/suspicious/noExplicitAny: ui.stream is optional in schema
    const streamConfig = (config as any).ui?.stream ?? {};
    const maxConnections = streamConfig.maxConnections ?? 50;
    const heartbeatIntervalMs = parseInterval(streamConfig.heartbeatInterval ?? "15s");
    const replayWindowMs = parseInterval(streamConfig.replayWindow ?? "60s");
    const fallbackPollSec = Math.max(
      1,
      Math.round(parseInterval(streamConfig.fallbackPollingInterval ?? "10s") / 1000),
    );

    const db = await getDb();
    const broker = getOrCreateBroker(config, db, maxConnections, replayWindowMs);

    if (broker.clientCount() >= maxConnections) {
      return new Response("Too many SSE connections", {
        status: 429,
        headers: { "Retry-After": String(fallbackPollSec) },
      });
    }

    // EventSource replay: client sends Last-Event-ID header on reconnect.
    const lastEventId = req.headers.get("last-event-id") ?? undefined;

    // biome-ignore lint/suspicious/noExplicitAny: session shape is app-defined
    const userId = (session as any).userId ?? (session as any).id ?? "anon";
    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const encoder = new TextEncoder();

    let unsubscribe: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream({
      async start(controller) {
        await broker.start();

        const send = (event: SseEvent) => {
          const frame = `id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(frame));
        };

        unsubscribe = broker.subscribe(clientId, send, lastEventId);

        // Initial hello + heartbeat — keeps proxies from closing the idle pipe.
        controller.enqueue(encoder.encode(`: flowpanel stream open\n\n`));
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`));
          } catch {
            // controller closed — cleanup will happen in cancel()
          }
        }, heartbeatIntervalMs);
      },
      cancel() {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Tell Nginx / Cloudflare / Vercel edge not to buffer us.
        "X-Accel-Buffering": "no",
        // Client polling fallback hint — used by useLive when EventSource fails.
        "X-FlowPanel-Fallback-Poll": String(fallbackPollSec),
      },
    });
  };

  return { GET };
}

function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)([smh])$/);
  if (!match) return 15_000;
  const [, num, unit] = match;
  return (
    Number.parseInt(num ?? "15", 10) * (unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000)
  );
}
