import {
  createPublisher,
  type Publisher,
  type PublisherOptions,
  type ResolvedAdminConfig,
} from "@flowpanel/core";

/** Package-local singleton publisher for @flowpanel/next. */
const STORE_KEY = Symbol.for("@flowpanel/next.publisherStore");
interface PublisherStore {
  publisher: Publisher | null;
  boundOptions: string | null;
  clientIds: WeakMap<object, number>;
  nextClientId: number;
  warnedUnbound: boolean;
  warnedMemory: boolean;
}
const globalStore = globalThis as typeof globalThis & {
  [STORE_KEY]?: PublisherStore;
};
if (!globalStore[STORE_KEY]) {
  globalStore[STORE_KEY] = {
    publisher: null,
    boundOptions: null,
    clientIds: new WeakMap(),
    nextClientId: 0,
    warnedUnbound: false,
    warnedMemory: false,
  };
}
const store: PublisherStore = globalStore[STORE_KEY];

function clientId(client: object): number {
  let id = store.clientIds.get(client);
  if (id === undefined) {
    store.nextClientId += 1;
    id = store.nextClientId;
    store.clientIds.set(client, id);
  }
  return id;
}

/** The identity of a transport: the options, never the config object, which Next.js re-creates per route bundle. */
function optionsKey(opts: PublisherOptions): string {
  if (opts.driver === "memory") return '{"driver":"memory"}';
  return JSON.stringify({
    driver: "redis",
    url: opts.url ?? null,
    keyPrefix: opts.keyPrefix ?? null,
    client: opts.client ? clientId(opts.client) : null,
  });
}

function warnIfMemoryWhileRedisConfigured(opts: PublisherOptions): void {
  if (opts.driver !== "memory" || store.warnedMemory) return;
  const named = process.env.REDIS_URL
    ? "REDIS_URL"
    : process.env.FLOWPANEL_REDIS_URL
      ? "FLOWPANEL_REDIS_URL"
      : null;
  if (!named) return;
  store.warnedMemory = true;
  console.warn(
    `[flowpanel] realtime driver is memory while ${named} is set — other ` +
      "instances and workers will not receive events; set realtime: { driver: " +
      `'redis', url: process.env.${named} } in defineAdmin`,
  );
}

/**
 * Binds the process-wide publisher to `config.realtime`, rebinding when the options
 * change — including a `client` that is a different instance than the bound one.
 */
export function bindPublisher(config: ResolvedAdminConfig): void {
  const options: PublisherOptions = config.realtime ?? { driver: "memory" };
  const key = optionsKey(options);
  if (store.publisher && store.boundOptions === key) return;
  const previous = store.publisher;
  store.publisher = createPublisher(options);
  store.boundOptions = key;
  warnIfMemoryWhileRedisConfigured(options);
  if (previous) {
    void previous.close?.().catch(() => {});
  }
}

export function resetPublisherForTests(): void {
  store.publisher = null;
  store.boundOptions = null;
  store.warnedUnbound = false;
  store.warnedMemory = false;
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
        "your worker/cron/script, publish through @flowpanel/kit/publish, or " +
        "route the publish through a FlowPanel route handler.",
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
