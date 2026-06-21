/** Stub for re-enqueuing a scrape run — replace with your worker/queue call. */
export async function retryRun(runId: number): Promise<void> {
  if (!Number.isFinite(runId)) throw new Error("invalid run id");
  // await scrapeQueue.add("run", { runId }) …
}
