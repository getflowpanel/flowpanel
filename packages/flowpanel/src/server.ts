import { createPublisher, type Publisher } from "@flowpanel/core";

export {
  checkRequireRole as requireRole,
  emitAudit,
  getRequestContext,
  runWithRequestContext,
  tryGetRequestContext,
} from "@flowpanel/core";
export type { Publisher };

let publisher: Publisher | null = null;

function getPublisher(): Publisher {
  if (!publisher) publisher = createPublisher({ driver: "memory" });
  return publisher;
}

/** Publish an event to an SSE channel. */
export async function publish(channel: string, payload?: unknown): Promise<void> {
  return getPublisher().publish(channel, payload);
}

export async function publishResource(
  name: string,
  event: { action: "create" | "update" | "delete"; id?: string },
): Promise<void> {
  return getPublisher().publish(`resource.${name}`, event);
}
