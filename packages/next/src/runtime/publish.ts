import { createPublisher, type Publisher } from "@flowpanel/core";

/**
 * Package-local singleton publisher for @flowpanel/next.
 *
 * CAVEAT (M2.5 → M3): `flowpanel/server` maintains its own in-process
 * singleton publisher with the same API. Because the memory driver keeps
 * subscribers in a per-instance Map, events published via `@flowpanel/next`
 * are NOT visible to subscribers connected through `flowpanel/server`, and
 * vice-versa. This is acceptable for memory-backed dev use because the SSE
 * broker is per-process anyway; in M3 both singletons will consolidate onto
 * the Redis-backed publisher with a shared backend.
 *
 * This module exists to avoid an `@flowpanel/next` → `flowpanel` circular
 * dependency (`flowpanel/server` depends on `@flowpanel/next` transitively).
 */
let publisher: Publisher | null = null;

function getPublisher(): Publisher {
  if (!publisher) publisher = createPublisher({ driver: "memory" });
  return publisher;
}

export async function publish(channel: string, payload?: unknown): Promise<void> {
  return getPublisher().publish(channel, payload);
}

export async function publishResource(
  name: string,
  event: { action: "create" | "update" | "delete"; id?: string },
): Promise<void> {
  return getPublisher().publish(`resource.${name}`, event);
}
