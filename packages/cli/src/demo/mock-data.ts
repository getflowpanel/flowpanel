// Seeded PRNG for deterministic data
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const STAGES = ["ingest", "parse", "embed", "index"];

type RunStatus = "running" | "succeeded" | "failed";

interface DemoRun {
  id: string;
  stage: string;
  partition_key: string;
  status: RunStatus;
  duration_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  meta: Record<string, unknown> | null;
}

// Build a deterministic 8-hour scenario:
// Hours 9-13: steady throughput, ~2% error rate
// Hour 14 (incident): parse stage 40% error rate, embed backs up
// Hours 15-16 (recovery): errors decrease, queue drains
function buildScenarioRuns(): DemoRun[] {
  const rand = seededRandom(42);
  const runs: DemoRun[] = [];
  let idCounter = 1000;

  const now = new Date();
  // Anchor the scenario to the last 8 hours
  const scenarioStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  for (let minuteOffset = 0; minuteOffset < 480; minuteOffset++) {
    const minuteTime = new Date(scenarioStart.getTime() + minuteOffset * 60 * 1000);
    const hourInScenario = Math.floor(minuteOffset / 60); // 0-7

    // Throughput: ~1 run per minute steady, ~2 during hour 2-4
    const throughput = hourInScenario >= 2 && hourInScenario <= 4 ? 2 : 1;

    for (let t = 0; t < throughput; t++) {
      const id = String(idCounter++);
      const stage = STAGES[Math.floor(rand() * STAGES.length)] ?? "ingest";
      const partitionKey = `doc-${Math.floor(rand() * 9999)
        .toString()
        .padStart(4, "0")}`;

      // Error logic
      const isIncident = hourInScenario === 5; // hour 14 scenario = offset hour 5
      const isRecovery = hourInScenario === 6 || hourInScenario === 7;

      let errorRate: number;
      if (isIncident && stage === "parse") {
        errorRate = 0.4;
      } else if (isIncident && stage === "embed") {
        errorRate = 0.15;
      } else if (isRecovery) {
        errorRate = 0.05;
      } else {
        errorRate = 0.02;
      }

      const r = rand();
      let status: RunStatus;
      let errorClass: string | null = null;
      let errorMessage: string | null = null;
      let durationMs: number | null;

      if (r < 0.01 && !isIncident) {
        // Running (rare)
        status = "running";
        durationMs = null;
      } else if (r < errorRate + 0.01) {
        status = "failed";
        durationMs = Math.floor(500 + rand() * 4500);

        if (isIncident && stage === "parse") {
          errorClass = rand() < 0.6 ? "TimeoutError" : "ValidationError";
          errorMessage =
            errorClass === "TimeoutError"
              ? "TimeoutError: PDF extraction exceeded 30s limit"
              : "ValidationError: document exceeds maximum size (15.2MB > 10MB)";
        } else if (stage === "embed" && rand() < 0.1) {
          errorClass = "OutOfMemoryError";
          errorMessage = "OutOfMemoryError: embedding buffer allocation failed (2.1GB requested)";
        } else {
          errorClass = "ConnectionError";
          errorMessage = "ConnectionError: upstream service unavailable after 3 retries";
        }
      } else {
        status = "succeeded";
        durationMs = Math.floor(200 + rand() * 3000);
      }

      const startedAt = new Date(minuteTime.getTime() + Math.floor(rand() * 60000));
      const finishedAt = durationMs != null ? new Date(startedAt.getTime() + durationMs) : null;

      runs.push({
        id,
        stage,
        partition_key: partitionKey,
        status,
        duration_ms: durationMs,
        error_class: errorClass,
        error_message: errorMessage,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt?.toISOString() ?? null,
        meta:
          status === "succeeded"
            ? { tokens: Math.floor(rand() * 3000 + 100), model: "text-embedding-3-small" }
            : null,
      });
    }
  }

  return runs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}

let _cachedRuns: DemoRun[] | null = null;

export function generateDemoRuns(count: number): Array<Record<string, unknown>> {
  if (!_cachedRuns) _cachedRuns = buildScenarioRuns();
  return _cachedRuns.slice(0, count) as Array<Record<string, unknown>>;
}

export function generateDemoMetrics() {
  return {
    throughput: { value: 847 },
    errorRate: { value: 3.2 },
    avgLatency: { value: 1240 },
    activeRuns: { value: 3 },
  };
}

export function generateDemoStages() {
  if (!_cachedRuns) _cachedRuns = buildScenarioRuns();
  const stageMap = new Map<
    string,
    {
      total: number;
      succeeded: number;
      failed: number;
      running: number;
      totalMs: number;
      countMs: number;
    }
  >();

  for (const stage of STAGES) {
    stageMap.set(stage, { total: 0, succeeded: 0, failed: 0, running: 0, totalMs: 0, countMs: 0 });
  }

  for (const run of _cachedRuns) {
    const s = stageMap.get(run.stage);
    if (!s) continue;
    s.total++;
    if (run.status === "succeeded") s.succeeded++;
    else if (run.status === "failed") s.failed++;
    else s.running++;
    if (run.duration_ms != null) {
      s.totalMs += run.duration_ms;
      s.countMs++;
    }
  }

  return STAGES.map((stage) => {
    const s = stageMap.get(stage);
    if (!s) return { stage, total: 0, succeeded: 0, failed: 0, running: 0, avgDurationMs: 0 };
    return {
      stage,
      total: s.total,
      succeeded: s.succeeded,
      failed: s.failed,
      running: s.running,
      avgDurationMs: s.countMs > 0 ? Math.round(s.totalMs / s.countMs) : 0,
    };
  });
}

export const DEMO_CONFIG = {
  appName: "Document Processing Pipeline",
  timezone: "UTC",
  basePath: "/admin",
  pipeline: {
    stages: STAGES,
    stageColors: {
      ingest: "#38bdf8",
      parse: "#818cf8",
      embed: "#6ee7b7",
      index: "#fb923c",
    },
  },
  metrics: {
    throughput: { label: "Throughput/hr", format: "number" },
    errorRate: { label: "Error Rate", format: "percent" },
    avgLatency: { label: "Avg Latency", format: "duration" },
    activeRuns: { label: "Active Runs", format: "number" },
  },
  theme: { colorScheme: "dark" },
};
