const STAGES = ["ingest", "transform", "embed", "index"];
const ERROR_MESSAGES = [
  "TimeoutError: embedding API exceeded 30s",
  "ValidationError: document too large (15.2MB > 10MB limit)",
  "ConnectionError: upstream service unavailable",
  "RateLimitError: OpenAI quota exceeded",
];

export function generateDemoRuns(count: number): Array<Record<string, unknown>> {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const runs: Array<Record<string, unknown>> = [];

  for (let i = 0; i < count; i++) {
    const id = String(1000 + i);
    const age = Math.random() * dayMs;
    const createdAt = new Date(now - age);
    const hour = createdAt.getUTCHours();
    const minute = createdAt.getUTCMinutes();
    const stage = STAGES[Math.floor(Math.random() * STAGES.length)]!;

    const isIncidentBurst = hour === 14 && minute >= 25 && minute <= 45;
    const rand = Math.random();

    let status: string;
    let errorMessage: string | null = null;
    let durationMs: number | null;

    if (rand < 0.03 && !isIncidentBurst) {
      status = "running";
      durationMs = null;
    } else if (rand < 0.15 || isIncidentBurst) {
      status = "failed";
      errorMessage = ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)]!;
      durationMs = Math.floor(500 + Math.random() * 5000);
    } else {
      status = "completed";
      durationMs = Math.floor(200 + Math.random() * 3000);
    }

    runs.push({
      id,
      stage,
      partition_key: `doc-${Math.floor(Math.random() * 10000)}`,
      status,
      duration_ms: durationMs,
      error_message: errorMessage,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      meta: { tokens: Math.floor(Math.random() * 3000), model: "gpt-4o" },
    });
  }

  runs.sort(
    (a, b) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime(),
  );
  return runs;
}

export function generateDemoMetrics() {
  return {
    throughput: { value: Math.floor(800 + Math.random() * 200) },
    errorRate: { value: Number((Math.random() * 5).toFixed(1)) },
    avgLatency: { value: Math.floor(400 + Math.random() * 300) },
    activeRuns: { value: Math.floor(Math.random() * 5) },
  };
}

export function generateDemoStages() {
  return STAGES.map((stage) => ({
    stage,
    total: Math.floor(100 + Math.random() * 200),
    succeeded: Math.floor(80 + Math.random() * 150),
    failed: Math.floor(5 + Math.random() * 20),
    running: Math.floor(Math.random() * 3),
    avgDurationMs: Math.floor(500 + Math.random() * 2000),
  }));
}

export const DEMO_CONFIG = {
  appName: "Acme AI Pipeline",
  timezone: "UTC",
  basePath: "/admin",
  pipeline: {
    stages: STAGES,
    stageColors: { ingest: "#38BDF8", transform: "#818cf8", embed: "#6ee7b7", index: "#fb923c" },
  },
  metrics: {
    throughput: { label: "Throughput", format: "number" },
    errorRate: { label: "Error Rate", format: "percent" },
    avgLatency: { label: "Avg Latency", format: "duration" },
    activeRuns: { label: "Active Runs", format: "number" },
  },
  theme: { colorScheme: "dark" },
};
