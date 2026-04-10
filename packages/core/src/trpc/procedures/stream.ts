import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getOrCreateBroker } from "../../sse/broker.js";
import type { FlowPanelContext } from "../context.js";

export function createStreamProcedure(
	// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
	t: { procedure: any; router: (routes: any) => any },
	// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
	authedProcedure: any,
) {
	return t.router({
		connect: authedProcedure
			.input(
				z.object({
					lastEventId: z.string().optional(),
				}),
			)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
			.query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
				const { config, db } = ctx;
				// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
				const streamConfig = (config as any).ui?.stream ?? {};
				const maxConnections = streamConfig.maxConnections ?? 50;
				const heartbeatIntervalMs = parseInterval(streamConfig.heartbeatInterval ?? "15s");
				const replayWindowMs = parseInterval(streamConfig.replayWindow ?? "60s");

				// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
				const broker = getOrCreateBroker(config as any, db, maxConnections, replayWindowMs);

				if (broker.clientCount() >= maxConnections) {
					throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many SSE connections" });
				}

				const clientId = `${ctx.session.userId}-${Date.now()}`;
				const encoder = new TextEncoder();

				const stream = new ReadableStream({
					start(controller) {
						function send(event: import("../../sse/broker.js").SseEvent) {
							const data = `id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
							controller.enqueue(encoder.encode(data));
						}

						const unsubscribe = broker.subscribe(clientId, send, input.lastEventId);

						const heartbeat = setInterval(() => {
							controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`));
						}, heartbeatIntervalMs);

						// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
						(controller as any).cancel = () => {
							clearInterval(heartbeat);
							unsubscribe();
						};
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream; charset=utf-8",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
						"X-FlowPanel-Fallback-Poll": String(
							parseInterval(streamConfig.fallbackPollingInterval ?? "10s") / 1000,
						),
					},
				});
			}),
	});
}

function parseInterval(interval: string): number {
	const match = interval.match(/^(\d+)([smh])$/);
	if (!match) return 15_000;
	const [, num, unit] = match;
	return parseInt(num!) * (unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000);
}
