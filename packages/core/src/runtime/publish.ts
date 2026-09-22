import { decodePayload, encodePayload } from "./envelope";
import { createRedisPublisher, type RedisLike } from "./redis-publisher";

export interface Publisher {
  publish(channel: string, payload?: unknown): Promise<void>;
  subscribe(channel: string, handler: (payload: unknown) => void): () => void;
  /** Release the transport's connections. Publishing afterwards throws. */
  close?(): Promise<void>;
}

export type PublisherOptions =
  | { driver: "memory" }
  | {
      driver: "redis";
      /** Connection string. Required unless `client` is given. */
      url?: string;
      /** A configured `ioredis`-compatible client to use instead of opening one. */
      client?: RedisLike;
      /**
       * Namespaces the wire channel, so several admins can share one Redis.
       * @defaultValue `"flowpanel"`
       */
      keyPrefix?: string;
    };

/** Build an SSE realtime publisher. No connection opens until the first publish. */
export function createPublisher(opts: PublisherOptions): Publisher {
  if (opts.driver === "memory") return createMemoryPublisher();
  return createRedisPublisher(opts);
}

function createMemoryPublisher(): Publisher {
  const subs = new Map<string, Set<(p: unknown) => void>>();
  let closed = false;
  return {
    async publish(channel, payload) {
      if (closed) throw new Error("[flowpanel] this realtime publisher is closed.");
      // Serialize first, and always: a payload Redis would reject must not
      // depend on whether this process happens to have a subscriber.
      const body = encodePayload(channel, payload);
      const handlers = subs.get(channel);
      if (!handlers) return;
      const delivered = decodePayload(body);
      for (const h of handlers) h(delivered);
    },
    subscribe(channel, handler) {
      if (closed) return () => {};
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
    async close() {
      closed = true;
      subs.clear();
    },
  };
}
