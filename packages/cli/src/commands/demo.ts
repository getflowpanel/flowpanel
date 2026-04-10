import kleur from "kleur";
import ora from "ora";
import { loadConfig } from "../loadConfig.js";

export async function runDemo() {
	const spinner = ora("Loading config...").start();

	let config: Awaited<ReturnType<typeof loadConfig>>;
	try {
		config = await loadConfig();
	} catch (err) {
		spinner.fail("Could not load flowpanel.config.ts");
		console.error(kleur.red(`  ${err}`));
		process.exit(1);
	}

	const db = config.adapter;
	if (!db) {
		spinner.fail("No adapter configured");
		process.exit(1);
	}

	spinner.text = "Seeding 500 demo runs...";

	const stages = config.pipeline?.stages ?? ["ingest", "process", "notify"];
	const stageWeights =
		stages.length === 4 ? [0.44, 0.28, 0.16, 0.12] : stages.map(() => 1 / stages.length);

	const stageDurations: Array<[number, number]> = stages.map((_, i) => {
		const durations: Array<[number, number]> = [
			[200, 500],
			[1500, 3000],
			[1000, 2500],
			[80, 200],
		];
		return durations[i % durations.length];
	});

	const errorMessages = [
		"OpenAI rate limit exceeded",
		"Connection timeout to upstream",
		"DB constraint violation: unique_user_run",
		"Invalid response format from API",
		"Memory limit exceeded during processing",
	];

	const now = Date.now();
	let seeded = 0;

	for (let i = 0; i < 500; i++) {
		const hoursAgo = Math.random() * 24;
		const startedAt = new Date(now - hoursAgo * 3600000);

		// Business hours bias (UTC 08-18)
		const hour = startedAt.getUTCHours();
		const isBusinessHours = hour >= 8 && hour <= 18;
		if (!isBusinessHours && Math.random() > 0.35) continue;

		const stageIdx = weightedRandom(stageWeights);
		const stage = stages[stageIdx];
		const [minDur, maxDur] = stageDurations[stageIdx];
		const duration = Math.floor(minDur + Math.random() * (maxDur - minDur));

		const statusRoll = Math.random();
		const status = statusRoll < 0.97 ? "succeeded" : statusRoll < 0.99 ? "failed" : "running";

		const userId = `user_${String(Math.floor(Math.random() * 20) + 1).padStart(3, "0")}`;
		const errorMessage =
			status === "failed" ? errorMessages[Math.floor(Math.random() * errorMessages.length)] : null;
		const errorClass = errorMessage
			? errorMessage.split(":")[0].split(" ").slice(0, 3).join("")
			: null;

		try {
			await db.execute(
				`INSERT INTO flowpanel_pipeline_run (stage, status, partition_key, duration_ms, error_class, error_message, started_at, is_demo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
				[
					stage,
					status,
					userId,
					status === "running" ? null : duration,
					errorClass,
					errorMessage,
					startedAt,
				],
			);
			seeded++;
		} catch (err: unknown) {
			console.error(`[FlowPanel] Failed to insert run: ${(err as Error).message}`);
		}

		if (seeded % 100 === 0 && seeded > 0) {
			spinner.text = `Seeding demo runs... ${seeded}/500`;
		}
	}

	spinner.succeed(`Seeded ${seeded} demo runs across ${stages.length} stages`);
}

function weightedRandom(weights: number[]): number {
	const r = Math.random();
	let sum = 0;
	for (let i = 0; i < weights.length; i++) {
		sum += weights[i];
		if (r <= sum) return i;
	}
	return weights.length - 1;
}
