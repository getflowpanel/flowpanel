import { type NextRequest, NextResponse } from "next/server";

// Mock tRPC responses for E2E testing — no real DB needed

const MOCK_RUNS = Array.from({ length: 20 }, (_, i) => ({
  id: `run-${i + 1}`,
  stage: ["parse", "score", "draft", "notify"][i % 4],
  partition_key: `user-${(i % 5) + 1}`,
  status: i % 7 === 0 ? "failed" : i % 3 === 0 ? "running" : "succeeded",
  duration_ms: Math.floor(Math.random() * 5000) + 200,
  created_at: new Date(Date.now() - i * 60_000).toISOString(),
  is_demo: false,
}));

const MOCK_STAGE_DATA = [
  { stage: "parse", total: 1929, succeeded: 1910, failed: 12, running: 7, avgDurationMs: 340 },
  { stage: "score", total: 1218, succeeded: 1200, failed: 8, running: 10, avgDurationMs: 2100 },
  { stage: "draft", total: 681, succeeded: 673, failed: 3, running: 5, avgDurationMs: 1800 },
  { stage: "notify", total: 529, succeeded: 526, failed: 2, running: 1, avgDurationMs: 120 },
];

const MOCK_METRICS = {
  totalRuns: { value: 4357, trend: "+12.3%" },
  successRate: { value: "99.2%", trend: "+0.1%" },
};

function tRPCResponse<T>(data: T) {
  return NextResponse.json({ result: { data } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ trpc: string[] }> }) {
  const { trpc } = await params;
  const procedure = trpc.join(".");

  if (procedure === "flowpanel.metrics.current") {
    return tRPCResponse(MOCK_METRICS);
  }

  if (procedure === "flowpanel.stages.breakdown") {
    return tRPCResponse(MOCK_STAGE_DATA);
  }

  if (procedure === "flowpanel.runs.list") {
    const url = new URL(req.url);
    const inputRaw = url.searchParams.get("input");
    const input = inputRaw ? (JSON.parse(decodeURIComponent(inputRaw)) as { cursor?: string }) : {};
    const runs = input.cursor ? MOCK_RUNS.slice(10) : MOCK_RUNS.slice(0, 10);
    return tRPCResponse({ runs, nextCursor: input.cursor ? null : "cursor-page-2" });
  }

  if (procedure === "flowpanel.drawers.render") {
    const url = new URL(req.url);
    const inputRaw = url.searchParams.get("input");
    const input = inputRaw
      ? (JSON.parse(decodeURIComponent(inputRaw)) as { drawerId: string; runId?: string })
      : { drawerId: "" };

    // stat-grid: aggregate stats
    const statData = {
      total: 4357,
      succeeded: 4321,
      failed: 36,
      running: 0,
      avg_duration_ms: 1240,
      p95_duration_ms: 4800,
    };

    // trend-chart: last 12 hourly buckets
    const trendData = Array.from({ length: 12 }, (_, i) => ({
      bucket: `${String(i).padStart(2, "0")}:00`,
      value: Math.floor(50 + Math.sin(i / 2) * 30 + Math.random() * 40),
    }));

    // breakdown by stage
    const breakdownData = [
      { stage: "parse", count: 1929 },
      { stage: "score", count: 1218 },
      { stage: "draft", count: 681 },
      { stage: "notify", count: 529 },
    ];

    const sections: Array<{ type: string; data: unknown }> = [
      { type: "stat-grid", data: statData },
      { type: "trend-chart", data: trendData },
      { type: "breakdown", data: breakdownData },
    ];

    // If opening a specific run — add kv-grid with run fields
    if (input.runId) {
      const run = MOCK_RUNS.find((r) => r.id === input.runId);
      if (run) {
        const { status, stage, duration_ms, ...rest } = run;
        sections.unshift({ type: "stat-grid", data: { status, stage, duration_ms } });
        sections.push({ type: "kv-grid", data: rest });
      }
    }

    return tRPCResponse({ sections, run: null, actions: [] });
  }

  if (procedure === "flowpanel.stream.connect") {
    // SSE endpoint — send heartbeat and a few mock events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(": connected\n\n"));
        controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`));

        // Simulate a new run after 500ms
        setTimeout(() => {
          try {
            const run = {
              id: "run-live-1",
              stage: "score",
              status: "running",
              partition_key: "user-99",
              duration_ms: null,
              created_at: new Date().toISOString(),
            };
            controller.enqueue(
              encoder.encode(`event: run.created\ndata: ${JSON.stringify(run)}\n\n`),
            );
          } catch {
            // Stream already closed (client disconnected)
          }
        }, 500);

        // Simulate run finishing after 2s
        setTimeout(() => {
          try {
            controller.enqueue(
              encoder.encode(
                `event: run.finished\ndata: ${JSON.stringify({ id: "run-live-1", status: "succeeded", durationMs: 1200 })}\n\n`,
              ),
            );
          } catch {
            // Stream already closed (client disconnected)
          }
        }, 2000);

        // Keep alive for 30s then close
        setTimeout(() => controller.close(), 30_000);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  return NextResponse.json({ error: "Unknown procedure" }, { status: 404 });
}

// ─── Resource mocks ──────────────────────────────────────────────────────────

const MOCK_USERS: Record<string, unknown>[] = [
  {
    id: 1,
    email: "alice@example.com",
    name: "Alice",
    role: "admin",
    createdAt: new Date(Date.now() - 86400_000 * 30).toISOString(),
  },
  {
    id: 2,
    email: "bob@example.com",
    name: "Bob",
    role: "user",
    createdAt: new Date(Date.now() - 86400_000 * 14).toISOString(),
  },
  {
    id: 3,
    email: "carol@example.com",
    name: "Carol",
    role: "user",
    createdAt: new Date(Date.now() - 86400_000 * 7).toISOString(),
  },
];

const SERIALIZED_USERS_RESOURCE = {
  id: "users",
  modelName: "User",
  primaryKey: "id",
  label: "User",
  labelPlural: "Users",
  icon: "users",
  path: "users",
  defaultSort: { field: "id", dir: "desc" },
  defaultPageSize: 50,
  searchFields: ["email", "name"],
  columns: [
    { id: "id", path: "id", label: "Id", type: "field", format: "auto", opts: {} },
    { id: "email", path: "email", label: "Email", type: "field", format: "auto", opts: {} },
    { id: "name", path: "name", label: "Name", type: "field", format: "auto", opts: {} },
    { id: "role", path: "role", label: "Role", type: "field", format: "enum", opts: {} },
    {
      id: "createdAt",
      path: "createdAt",
      label: "Created At",
      type: "field",
      format: "relative",
      opts: {},
    },
  ],
  filters: [
    {
      id: "role",
      path: "role",
      label: "Role",
      mode: "enum",
      opts: { options: ["admin", "user"] },
    },
  ],
  actions: [],
  access: { list: true, read: true, create: true, update: true, delete: true },
  fieldAccess: [],
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ trpc: string[] }> }) {
  const { trpc } = await params;
  const procedure = trpc.join(".");
  const body = (await req.json()) as Record<string, unknown>;

  // Test helper: create a run
  if (procedure === "flowpanel.test.createRun") {
    const run = {
      id: `run-test-${Date.now()}`,
      stage: (body.stage as string) ?? "score",
      status: "running",
      partition_key: "test-user",
      duration_ms: null,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ runId: run.id, run });
  }

  // ── Resource procedures ─────────────────────────────────────────────────
  if (procedure === "flowpanel.resource.schema") {
    return tRPCResponse({ resources: { users: SERIALIZED_USERS_RESOURCE } });
  }

  if (procedure === "flowpanel.resource.list") {
    const input = body as {
      resourceId: string;
      page: number;
      pageSize: number;
      search?: { query: string };
      filters?: Array<{ field: string; op: string; value: unknown }>;
    };
    let rows = [...MOCK_USERS];
    if (input.search?.query) {
      const q = input.search.query.toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.email ?? "")
            .toLowerCase()
            .includes(q) ||
          String(r.name ?? "")
            .toLowerCase()
            .includes(q),
      );
    }
    if (input.filters) {
      for (const f of input.filters) {
        rows = rows.filter((r) => {
          const v = r[f.field];
          if (f.op === "eq") return v === f.value;
          if (f.op === "in" && Array.isArray(f.value)) return f.value.includes(v);
          return true;
        });
      }
    }
    const total = rows.length;
    const start = (input.page - 1) * input.pageSize;
    const data = rows.slice(start, start + input.pageSize);
    return tRPCResponse({
      data,
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    });
  }

  if (procedure === "flowpanel.resource.get") {
    const input = body as { recordId: number | string };
    const row = MOCK_USERS.find((r) => r.id === input.recordId);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return tRPCResponse(row);
  }

  if (procedure === "flowpanel.resource.create") {
    const input = body as { data: Record<string, unknown> };
    const row = { id: MOCK_USERS.length + 1, createdAt: new Date().toISOString(), ...input.data };
    MOCK_USERS.push(row);
    return tRPCResponse(row);
  }

  if (procedure === "flowpanel.resource.update") {
    const input = body as { recordId: number | string; data: Record<string, unknown> };
    const idx = MOCK_USERS.findIndex((r) => r.id === input.recordId);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    MOCK_USERS[idx] = { ...MOCK_USERS[idx], ...input.data };
    return tRPCResponse(MOCK_USERS[idx]);
  }

  if (procedure === "flowpanel.resource.delete") {
    const input = body as { recordId: number | string };
    const idx = MOCK_USERS.findIndex((r) => r.id === input.recordId);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    MOCK_USERS.splice(idx, 1);
    return tRPCResponse({ success: true });
  }

  return NextResponse.json({ error: "Unknown procedure" }, { status: 404 });
}
