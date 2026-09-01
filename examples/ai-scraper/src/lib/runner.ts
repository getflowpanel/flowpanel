import { queuesByName } from "./queues";

/**
 * Re-enqueue a scrape. Without REDIS_URL there is no queue, so the run is only
 * reset in the database and the demo still works.
 */
export async function retryRun(runId: number, sandboxId: string): Promise<void> {
  if (!Number.isFinite(runId)) throw new Error("invalid run id");
  if (!sandboxId) throw new Error("invalid sandbox id");
  const scrape = queuesByName.scrape;
  if (!scrape) return;
  await scrape.add(
    "scrape",
    { runId, sandboxId },
    { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  );
}
