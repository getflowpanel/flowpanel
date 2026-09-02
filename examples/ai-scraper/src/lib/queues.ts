import { Queue } from "bullmq";

const QUEUE_NAMES = ["scrape", "extract", "billing"] as const;

function connect(name: string, redisUrl: string): Queue {
  const url = new URL(redisUrl);
  return new Queue(name, {
    connection: {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
    },
  });
}

const redisUrl = process.env.REDIS_URL;

export const liveQueues = redisUrl
  ? QUEUE_NAMES.map((name) => ({ name, instance: connect(name, redisUrl) }))
  : [];

export const queuesByName: Record<string, Queue> = Object.fromEntries(
  liveQueues.map((q) => [q.name, q.instance]),
);
