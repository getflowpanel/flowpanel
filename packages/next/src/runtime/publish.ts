import { createPublisher, type Publisher, type ResolvedAdminConfig } from "@flowpanel/core";

/** Package-local singleton publisher for @flowpanel/next. */
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

/** Binds the process-wide publisher to `config.realtime`. */
export function bindPublisher(config: ResolvedAdminConfig): void {
  if (store.publisher) return;
  store.publisher = createPublisher(config.realtime ?? { driver: "memory" });
  store.boundConfig = config;
}

export function resetPublisherForTests(): void {
  store.publisher = null;
  store.boundConfig = null;
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
