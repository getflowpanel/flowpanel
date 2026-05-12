import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;

function makeQueue(name: string): Queue | null {
  if (!redisUrl) return null;
  const url = new URL(redisUrl);
  return new Queue(name, {
    connection: {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
    },
  });
}

// Queues are `Queue | null` at runtime when no Redis; assert non-null when REDIS_URL is set.
export const queuesMap = {
  scraper: makeQueue("scraper"),
  emails: makeQueue("emails"),
  billing: makeQueue("billing"),
};

export const queues = Object.fromEntries(
  Object.entries(queuesMap).filter(([, q]) => q !== null) as [string, Queue][],
) as Record<string, Queue>;
