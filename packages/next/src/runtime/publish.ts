import { createPublisher, type Publisher, type ResolvedAdminConfig } from "@flowpanel/core";

/**
 * Package-local singleton publisher for @flowpanel/next.
 *
 * Memory vs redis selection is driven by `config.realtime`; `bindPublisher(cfg)`
 * is called at every entry point (server actions, drawer route, page render)
 * so publishes land on the right driver per deployment. The binding is
 * idempotent — repeated calls with the same config object are no-ops.
 *
 * When `config.realtime` is unset we fall back to a memory publisher so tests
 * and dev flows keep working without explicit wiring.
 */
let publisher: Publisher | null = null;
let boundConfig: ResolvedAdminConfig | null = null;

/**
 * Binds the runtime publisher to the admin config's realtime settings.
 * Idempotent: calling with the same config object is a no-op. Calling with
 * a different config re-initializes the publisher (test-only scenario).
 */
export function bindPublisher(config: ResolvedAdminConfig): void {
  if (boundConfig === config && publisher) return;
  publisher = createPublisher(config.realtime ?? { driver: "memory" });
  boundConfig = config;
}

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

export function subscribe(channel: string, handler: (payload: unknown) => void): () => void {
  return getPublisher().subscribe(channel, handler);
}
