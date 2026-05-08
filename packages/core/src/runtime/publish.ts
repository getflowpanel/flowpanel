export interface Publisher {
  publish(channel: string, payload?: unknown): Promise<void>;
  subscribe(channel: string, handler: (payload: unknown) => void): () => void;
}

export type PublisherOptions =
  | { driver: "memory" }
  | { driver: "redis"; url: string; keyPrefix?: string };

export function createPublisher(opts: PublisherOptions): Publisher {
  if (opts.driver === "memory") return createMemoryPublisher();
  return createRedisPublisher(opts);
}

function createMemoryPublisher(): Publisher {
  const subs = new Map<string, Set<(p: unknown) => void>>();
  return {
    async publish(channel, payload) {
      const handlers = subs.get(channel);
      if (!handlers) return;
      for (const h of handlers) h(payload);
    },
    subscribe(channel, handler) {
      let handlers = subs.get(channel);
      if (!handlers) {
        handlers = new Set();
        subs.set(channel, handlers);
      }
      handlers.add(handler);
      return () => {
        handlers?.delete(handler);
        if (handlers?.size === 0) subs.delete(channel);
      };
    },
  };
}

function createRedisPublisher(opts: Extract<PublisherOptions, { driver: "redis" }>): Publisher {
  type RedisCtor = new (
    url: string,
  ) => {
    publish(channel: string, payload: string): Promise<number>;
    subscribe(channel: string): Promise<number>;
    unsubscribe(channel: string): Promise<number>;
    on(event: "message", cb: (channel: string, raw: string) => void): void;
    quit(): Promise<"OK">;
  };

  let Redis: RedisCtor | null = null;
  let pub: InstanceType<RedisCtor> | null = null;
  let sub: InstanceType<RedisCtor> | null = null;
  const handlers = new Map<string, Set<(p: unknown) => void>>();

  async function load() {
    if (!Redis) {
      // Specifier held in a variable so TypeScript does not statically
      // resolve `ioredis` — it is an optional peer dep and may be absent.
      const specifier = "ioredis";
      const mod = (await import(specifier).catch(() => null)) as
        | { default: RedisCtor }
        | RedisCtor
        | null;
      if (!mod) {
        throw new Error(
          "ioredis is not installed — required for realtime.driver='redis'. Run `pnpm add ioredis`.",
        );
      }
      Redis = "default" in mod ? mod.default : mod;
    }
    if (!pub) pub = new Redis(opts.url);
    if (!sub) {
      sub = new Redis(opts.url);
      sub.on("message", (channel, raw) => {
        let payload: unknown;
        try {
          payload = raw === "" ? undefined : JSON.parse(raw);
        } catch {
          payload = raw;
        }
        handlers.get(channel)?.forEach((h) => h(payload));
      });
    }
  }

  return {
    async publish(channel, payload) {
      await load();
      const body = payload === undefined ? "" : JSON.stringify(payload);
      await pub!.publish(channel, body);
    },
    subscribe(channel, handler) {
      let set = handlers.get(channel);
      const firstSubscriber = !set;
      if (!set) {
        set = new Set();
        handlers.set(channel, set);
      }
      set.add(handler);
      if (firstSubscriber) {
        void load()
          .then(() => sub?.subscribe(channel))
          .catch((err) => {
            console.error("[flowpanel] redis subscribe failed:", err);
          });
      }
      return () => {
        set?.delete(handler);
        if (set?.size === 0) {
          handlers.delete(channel);
          void sub?.unsubscribe(channel);
        }
      };
    },
  };
}
