import { createPublisher, type Publisher, type ResolvedAdminConfig } from "@flowpanel/core";

/** Package-local singleton publisher for @flowpanel/next. */
const STORE_KEY = Symbol.for("@flowpanel/next.publisherStore");
interface PublisherStore {
  publisher: Publisher | null;
  boundConfig: ResolvedAdminConfig | null;
  warnedUnbound: boolean;
}
const globalStore = globalThis as typeof globalThis & {
  [STORE_KEY]?: PublisherStore;
};
if (!globalStore[STORE_KEY]) {
  globalStore[STORE_KEY] = { publisher: null, boundConfig: null, warnedUnbound: false };
}
const store: PublisherStore = globalStore[STORE_KEY];

/** Binds the process-wide publisher to `config.realtime`, replacing any unbound fallback. */
export function bindPublisher(config: ResolvedAdminConfig): void {
  if (store.boundConfig) return;
  store.publisher = createPublisher(config.realtime ?? { driver: "memory" });
  store.boundConfig = config;
}

export function resetPublisherForTests(): void {
  store.publisher = null;
  store.boundConfig = null;
  store.warnedUnbound = false;
}

function getPublisher(): Publisher {
  if (store.publisher) return store.publisher;
  // A fallback memory publisher only reaches subscribers inside this process, so
  // in a worker/cron/script the publish is a no-op for every browser tab.
  if (!store.warnedUnbound) {
    store.warnedUnbound = true;
    console.warn(
      "[flowpanel] publish() ran before bindPublisher(config) in this process, " +
        "so it fell back to an in-memory publisher: subscribers on other " +
        "processes will not receive it. Call bindPublisher(config) at the top of " +
        "your worker/cron/script, or route the publish through a FlowPanel route handler.",
    );
  }
  store.publisher = createPublisher({ driver: "memory" });
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
