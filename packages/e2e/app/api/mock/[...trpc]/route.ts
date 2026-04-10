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

	if (procedure === "flowpanel.stream.connect") {
		// SSE endpoint — send heartbeat and a few mock events
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(": connected\n\n"));
				controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`));

				// Simulate a new run after 500ms
				setTimeout(() => {
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
				}, 500);

				// Simulate run finishing after 2s
				setTimeout(() => {
					controller.enqueue(
						encoder.encode(
							`event: run.finished\ndata: ${JSON.stringify({ id: "run-live-1", status: "succeeded", durationMs: 1200 })}\n\n`,
						),
					);
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ trpc: string[] }> }) {
	const { trpc } = await params;
	const procedure = trpc.join(".");
	const body = (await req.json()) as Record<string, unknown>;

	// Test helper: create a run
	if (procedure === "flowpanel.test.createRun") {
		const run = {
			id: `run-test-${Date.now()}`,
			stage: (body["stage"] as string) ?? "score",
			status: "running",
			partition_key: "test-user",
			duration_ms: null,
			created_at: new Date().toISOString(),
		};
		return NextResponse.json({ runId: run.id, run });
	}

	return NextResponse.json({ error: "Unknown procedure" }, { status: 404 });
}
