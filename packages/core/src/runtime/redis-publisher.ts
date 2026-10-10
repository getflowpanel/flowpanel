import { FlowpanelConfigError } from "../types/config-error";
import { decodePayload, encodePayload } from "./envelope";

/** The subscribing half of a Redis connection: a client in subscriber mode. */
export interface RedisSubscriber {
  subscribe(channel: string): Promise<number>;
  unsubscribe(channel: string): Promise<number>;
  on(event: "message", cb: (channel: string, raw: string) => void): unknown;
}

/** The slice of `ioredis` FlowPanel uses. Loose on purpose: any `ioredis` client is assignable. */
export interface RedisLike {
  publish(channel: string, message: string): Promise<unknown>;
  on(event: "error", cb: (err: unknown) => void): unknown;
  off?(event: "error", cb: (err: unknown) => void): unknown;
  removeListener?(event: "error", cb: (err: unknown) => void): unknown;
  /** A second connection for subscribing, checked at runtime for `subscribe`, `unsubscribe` and `on`. */
  duplicate?(): unknown;
}

/** What changed on a resource. */
export interface ResourceChange {
  /** @defaultValue "update" */
  action?: "create" | "update" | "delete";
  /** The changed record's key, when one record changed. */
  id?: string | number;
}

/** A publish-only realtime client, for a worker, a cron job or a script. */
export interface PublisherClient {
  publish(channel: string, payload?: unknown): Promise<void>;
  /**
   * Tell every open list and record page of the resource named `name` that its rows changed,
   * on `resource.<name>`.
   */
  resource(name: string, change?: ResourceChange): Promise<void>;
  /** The channel a resource's own events travel on: `resource.<name>`. */
  channelFor(resource: string): string;
  /** Release the connections this client opened. Idempotent; a host's client is left open. */
  close(): Promise<void>;
}

export interface RedisPublisher extends PublisherClient {
  subscribe(channel: string, handler: (payload: unknown) => void): () => void;
}

export interface RedisPublisherOptions {
  url?: string;
  client?: RedisLike;
  keyPrefix?: string;
}

type Connection = RedisLike & RedisSubscriber & { quit?(): Promise<unknown> };
type RedisCtor = new (url: string) => Connection;

export const CLOSED_MESSAGE = "[flowpanel] this realtime publisher is closed.";
const URL_PATTERN = /rediss?:\/\/\S+/g;

export function safeReason(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(URL_PATTERN, "<redis url>");
}

export function errorKind(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const shape = err as { code?: unknown; name?: unknown };
    if (typeof shape.code === "string") return shape.code;
    if (typeof shape.name === "string") return shape.name;
  }
  return "unknown";
}

function isSubscriber(value: unknown): value is RedisLike & RedisSubscriber {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return ["publish", "on", "subscribe", "unsubscribe"].every(
    (key) => typeof candidate[key] === "function",
  );
}

/** The event body a resource channel carries; the SSE route routes it to lists and record pages. */
export function resourceEvent(change: ResourceChange): {
  action: "create" | "update" | "delete";
  id?: string | number;
} {
  return {
    action: change.action ?? "update",
    ...(change.id === undefined ? {} : { id: change.id }),
  };
}

/** An unhandled `error` on a Redis connection takes the process down, so every connection gets one. */
function watchErrors(connection: RedisLike, seen: Set<string>): () => void {
  const handler = (err: unknown): void => {
    try {
      const kind = errorKind(err);
      if (seen.has(kind)) return;
      seen.add(kind);
      console.error(`[flowpanel] realtime redis connection error (${kind}): ${safeReason(err)}`);
    } catch {}
  };
  connection.on("error", handler);
  return () => {
    if (connection.off) connection.off("error", handler);
    else connection.removeListener?.("error", handler);
  };
}

/** Build a Redis-backed publisher. Nothing connects until the first publish or subscribe. */
export function createRedisPublisher(opts: RedisPublisherOptions): RedisPublisher {
  if (opts.client === undefined && opts.url === undefined) {
    throw new FlowpanelConfigError(
      "realtime",
      'the "redis" driver needs a connection. Set url, or pass an ioredis-compatible instance as client.',
    );
  }
  const keyPrefix = opts.keyPrefix ?? "flowpanel";
  const seen = new Set<string>();
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  const unwatch: Array<() => void> = [];
  let ctor: RedisCtor | null = null;
  let owned: Array<{ quit?(): Promise<unknown> }> = [];
  let pub: Promise<RedisLike> | null = null;
  let sub: Promise<RedisLike & RedisSubscriber> | null = null;
  let closed = false;
  let warnedClosed = false;

  if (opts.client) unwatch.push(watchErrors(opts.client, seen));

  function wireChannel(channel: string): string {
    return `${keyPrefix}:${channel}`;
  }

  async function load(): Promise<RedisCtor> {
    if (ctor) return ctor;
    const specifier = "ioredis";
    const mod = (await import(/* webpackIgnore: true */ specifier).catch(() => null)) as
      | { default: RedisCtor }
      | RedisCtor
      | null;
    if (!mod) {
      throw new Error(
        "ioredis is not installed — required for realtime.driver='redis'. Run `pnpm add ioredis`.",
      );
    }
    ctor = "default" in mod ? mod.default : mod;
    return ctor;
  }

  async function connect(): Promise<Connection> {
    if (opts.url === undefined) {
      throw new Error(
        "[flowpanel] the realtime `client` cannot open a second connection to subscribe: give it a `duplicate()` method, or set `url` as well.",
      );
    }
    const Redis = await load();
    const connection = new Redis(opts.url);
    unwatch.push(watchErrors(connection, seen));
    owned.push(connection);
    return connection;
  }

  function publisher(): Promise<RedisLike> {
    if (pub) return pub;
    const pending = opts.client ? Promise.resolve(opts.client) : connect();
    pub = pending;
    pending.catch(() => {
      if (pub === pending) pub = null;
    });
    return pending;
  }

  function dispatch(wire: string, raw: string): void {
    const channel = wire.startsWith(`${keyPrefix}:`) ? wire.slice(keyPrefix.length + 1) : wire;
    const payload = decodePayload(raw);
    for (const handler of handlers.get(channel) ?? []) handler(payload);
  }

  async function openSubscriber(): Promise<RedisLike & RedisSubscriber> {
    const duplicated = opts.client?.duplicate?.();
    let connection: RedisLike & RedisSubscriber;
    if (isSubscriber(duplicated)) {
      unwatch.push(watchErrors(duplicated, seen));
      owned.push(duplicated as Connection);
      connection = duplicated;
    } else {
      connection = await connect();
    }
    connection.on("message", dispatch);
    return connection;
  }

  function subscriber(): Promise<RedisLike & RedisSubscriber> {
    if (sub) return sub;
    const pending = openSubscriber();
    sub = pending;
    pending.catch(() => {
      if (sub === pending) sub = null;
    });
    return pending;
  }

  async function publish(channel: string, payload?: unknown): Promise<void> {
    if (closed) throw new Error(CLOSED_MESSAGE);
    const body = encodePayload(channel, payload);
    const connection = await publisher();
    await connection.publish(wireChannel(channel), body);
  }

  return {
    channelFor(resource) {
      return `resource.${resource}`;
    },
    publish,
    resource(name, change = {}) {
      return publish(`resource.${name}`, resourceEvent(change));
    },
    subscribe(channel, handler) {
      if (closed) {
        if (!warnedClosed) {
          warnedClosed = true;
          console.warn(
            `${CLOSED_MESSAGE} The subscription to "${channel}" was not registered — subscribe through the currently bound publisher.`,
          );
        }
        return () => {};
      }
      let set = handlers.get(channel);
      const first = !set;
      if (!set) {
        set = new Set();
        handlers.set(channel, set);
      }
      set.add(handler);
      if (first) {
        void subscriber()
          .then((connection) => connection.subscribe(wireChannel(channel)))
          .catch((err) => {
            console.error(`[flowpanel] redis subscribe failed: ${safeReason(err)}`);
          });
      }
      return () => {
        set?.delete(handler);
        if (set?.size === 0) {
          handlers.delete(channel);
          void sub
            ?.then((connection) => connection.unsubscribe(wireChannel(channel)))
            .catch((err) => {
              console.error(`[flowpanel] redis unsubscribe failed: ${safeReason(err)}`);
            });
        }
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      handlers.clear();
      for (const off of unwatch.splice(0)) off();
      const connections = owned;
      owned = [];
      pub = null;
      sub = null;
      await Promise.all(
        connections.map(async (connection) => {
          try {
            await connection.quit?.();
          } catch {}
        }),
      );
    },
  };
}
