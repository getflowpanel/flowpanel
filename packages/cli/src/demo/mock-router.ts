import { generateDemoMetrics, generateDemoRuns, generateDemoStages } from "./mock-data";

const runs = generateDemoRuns(500);

const handlers: Record<string, (input: Record<string, unknown>) => unknown> = {
  "flowpanel.metrics.getAll": () => generateDemoMetrics(),
  "flowpanel.stages.summary": () => generateDemoStages(),
  "flowpanel.runs.list": (input) => {
    const limit = (input.limit as number) ?? 50;
    const cursor = input.cursor as string | undefined;
    const startIdx = cursor ? runs.findIndex((r) => r.id === cursor) + 1 : 0;
    const slice = runs.slice(startIdx, startIdx + limit);
    return {
      runs: slice,
      nextCursor: slice.length === limit ? (slice[slice.length - 1]?.id as string) : null,
    };
  },
  "flowpanel.runs.get": (input) => runs.find((r) => r.id === input.runId) ?? null,
  "flowpanel.runs.chart": () => ({
    buckets: Array.from({ length: 24 }, (_, i) => ({
      label: `${i}:00`,
      total: Math.floor(20 + Math.random() * 40),
      succeeded: Math.floor(15 + Math.random() * 35),
      failed: i === 14 ? Math.floor(10 + Math.random() * 5) : Math.floor(Math.random() * 5),
    })),
    peakBucket: 14,
  }),
  "flowpanel.runs.topErrors": () => [
    { errorClass: "TimeoutError", count: 23 },
    { errorClass: "ValidationError", count: 12 },
    { errorClass: "ConnectionError", count: 8 },
  ],
  "flowpanel.drawers.render": (input) => runs.find((r) => r.id === input.runId) ?? null,
};

export function handleTrpcRequest(path: string, input: Record<string, unknown>): unknown {
  const procedure = path.replace("/api/trpc/", "");
  const handler = handlers[procedure];
  if (!handler) return { error: `Unknown procedure: ${procedure}` };
  return { result: { data: handler(input) } };
}

export function createSSESimulation() {
  let nextId = 2000;
  return {
    generateEvent() {
      const isFinish = Math.random() > 0.5;
      if (isFinish) {
        const run = runs[Math.floor(Math.random() * Math.min(10, runs.length))] ?? runs[0];
        return { event: "run.finished", data: { id: run.id, status: "ok", durationMs: 1200 } };
      }
      nextId++;
      const stage =
        ["ingest", "transform", "embed", "index"][Math.floor(Math.random() * 4)] ?? "ingest";
      const newRun: Record<string, unknown> = {
        id: String(nextId),
        stage,
        partition_key: `doc-${Math.floor(Math.random() * 10000)}`,
        status: "running",
        duration_ms: null,
        created_at: new Date().toISOString(),
        meta: { tokens: Math.floor(Math.random() * 3000), model: "gpt-4o" },
      };
      runs.unshift(newRun);
      return { event: "run.created", data: newRun };
    },
  };
}
