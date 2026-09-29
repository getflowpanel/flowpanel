import { encodePayload } from "./envelope";
import type { PublisherOptions } from "./publish";
import {
  CLOSED_MESSAGE,
  createRedisPublisher,
  errorKind,
  type PublisherClient,
  type RedisLike,
  type RedisPublisherOptions,
  resourceEvent,
  safeReason,
} from "./redis-publisher";

/** Receives a publish Redis did not take, instead of the caller's job failing. */
export type PublishErrorHandler = (err: unknown, channel: string) => void;

/** A URL or your own client — or the admin's own `realtime` options, so both sides share one prefix. */
export type WorkerPublisherOptions =
  | { redis: RedisLike | string; keyPrefix?: string; onError?: PublishErrorHandler }
  | (Extract<PublisherOptions, { driver: "redis" }> & { onError?: PublishErrorHandler });

function connectionOf(opts: WorkerPublisherOptions): RedisPublisherOptions {
  const prefix = opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix };
  if ("driver" in opts) {
    return {
      ...(opts.url === undefined ? {} : { url: opts.url }),
      ...(opts.client === undefined ? {} : { client: opts.client }),
      ...prefix,
    };
  }
  return {
    ...(typeof opts.redis === "string" ? { url: opts.redis } : { client: opts.redis }),
    ...prefix,
  };
}

function logOncePerKind(): PublishErrorHandler {
  const seen = new Set<string>();
  return (err, channel) => {
    const kind = errorKind(err);
    if (seen.has(kind)) return;
    seen.add(kind);
    console.error(
      `[flowpanel] realtime publish to "${channel}" failed (${kind}): ${safeReason(err)}`,
    );
  };
}

/**
 * A realtime publisher for a process that only publishes — a worker, a cron job, a script.
 * A Redis failure never rejects: it reaches `onError`, or is logged once per error kind.
 * @example
 * const events = createPublisher({ ...adminRealtimeOptions, onError: report });
 * await events.resource("orders", { id });
 */
export function createPublisher(opts: WorkerPublisherOptions): PublisherClient {
  const client = createRedisPublisher(connectionOf(opts));
  const report = opts.onError ?? logOncePerKind();
  let closed = false;

  async function publish(channel: string, payload?: unknown): Promise<void> {
    if (closed) throw new Error(CLOSED_MESSAGE);
    encodePayload(channel, payload);
    try {
      await client.publish(channel, payload);
    } catch (err) {
      try {
        report(err, channel);
      } catch {}
    }
  }

  return {
    publish,
    resource: (name, change = {}) => publish(client.channelFor(name), resourceEvent(change)),
    channelFor: client.channelFor,
    async close() {
      closed = true;
      await client.close();
    },
  };
}
