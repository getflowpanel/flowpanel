import { createPublisher, type Publisher } from "@flowpanel/core";

export {
  checkRequireRole as requireRole,
  emitAudit,
  getRequestContext,
  runWithRequestContext,
  tryGetRequestContext,
} from "@flowpanel/core";
export type { Publisher };

// Singleton in-memory publisher for M1. Redis-backed publisher lands in M3.
let publisher: Publisher | null = null;

function getPublisher(): Publisher {
  if (!publisher) publisher = createPublisher({ driver: "memory" });
  return publisher;
}

/**
 * Publish an event to an SSE channel.
 *
 * @example
 *   import { publish } from "flowpanel/server";
 *   scraperQueue.on("completed", async () => {
 *     await publish("scraperRuns");
 *   });
 */
export async function publish(channel: string, payload?: unknown): Promise<void> {
  return getPublisher().publish(channel, payload);
}

export async function publishResource(
  name: string,
  event: { action: "create" | "update" | "delete"; id?: string },
): Promise<void> {
  return getPublisher().publish(`resource.${name}`, event);
}
