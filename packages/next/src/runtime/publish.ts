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
// Stored on globalThis, NOT a module-local `let`. Next.js can give different
// route handlers (the SSE stream GET vs. the action POST) separate instances
// of this module, so a module-scoped singleton would make the memory driver's
// publish() land on a different publisher than the one the SSE route
// subscribed to — events would never cross. A process-global store guarantees
// one shared publisher across every route handler in the process.
const STORE_KEY = Symbol.for("@flowpanel/next.publisherStore");
interface PublisherStore {
  publisher: Publisher | null;
  boundConfig: ResolvedAdminConfig | null;
}
const globalStore = globalThis as typeof globalThis & {
  [STORE_KEY]?: PublisherStore;
};
if (!globalStore[STORE_KEY]) {
  globalStore[STORE_KEY] = { publisher: null, boundConfig: null };
}
const store: PublisherStore = globalStore[STORE_KEY];

/**
 * Binds the runtime publisher to the admin config's realtime settings.
 * Idempotent: calling with the same config object is a no-op. Calling with
 * a different config re-initializes the publisher (test-only scenario).
 */
export function bindPublisher(config: ResolvedAdminConfig): void {
  if (store.boundConfig === config && store.publisher) return;
  store.publisher = createPublisher(config.realtime ?? { driver: "memory" });
  store.boundConfig = config;
}

function getPublisher(): Publisher {
  if (!store.publisher) store.publisher = createPublisher({ driver: "memory" });
  return store.publisher;
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
