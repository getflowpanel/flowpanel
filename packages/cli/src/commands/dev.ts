import { exec } from "child_process";
import { watch } from "chokidar";
import kleur from "kleur";
import { platform } from "os";

export async function runDev(opts: { port?: string }) {
	console.log(kleur.bold("\n  ⚡ FlowPanel dev server\n"));

	let config: any;
	try {
		config = await loadConfig();
	} catch (err) {
		console.error(kleur.red(`  Config error: ${err}`));
		process.exit(1);
	}

	const port = opts.port ?? "3000";
	const basePath = config.basePath ?? "/admin";

	console.log(`  Dashboard:  ${kleur.cyan(`http://localhost:${port}${basePath}`)}`);
	console.log(`  Config:     ${kleur.gray("flowpanel.config.ts")} (watching)`);
	console.log(`  Stages:     ${kleur.gray(config.pipeline?.stages?.join(", ") ?? "none")}`);
	console.log(
		`  Metrics:    ${kleur.gray(String(Object.keys(config.metrics ?? {}).length) + " configured")}`,
	);
	console.log(
		`  Drawers:    ${kleur.gray(String(Object.keys(config.drawers ?? {}).length) + " configured")}`,
	);
	console.log(`\n  Watching for config changes... (Ctrl+C to stop)\n`);

	// Best-effort browser open
	const url = `http://localhost:${port}${basePath}`;
	const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
	exec(`${cmd} ${url}`, () => {});

	// Watch config file
	const watcher = watch("flowpanel.config.ts", { ignoreInitial: true });
	watcher.on("change", async () => {
		const time = new Date().toLocaleTimeString("en", { hour12: false });
		console.log(`  ${kleur.gray(time)} Config changed — revalidating...`);
		try {
			const newConfig = await loadConfig();
			console.log(
				`  ${kleur.green("✓")} Config valid (${newConfig.pipeline?.stages?.length ?? 0} stages, ${Object.keys(newConfig.metrics ?? {}).length} metrics)`,
			);
			console.log(`           Run ${kleur.cyan("flowpanel migrate:gen")} if schema changed\n`);
		} catch (err) {
			console.log(`  ${kleur.red("✗")} Config error: ${err}\n`);
		}
	});
}

async function loadConfig() {
	// Clear module cache for hot reload
	const configPath = `${process.cwd()}/flowpanel.config.ts`;
	delete require.cache?.[configPath];
	const mod = await import(configPath);
	return mod.default ?? mod.config;
}
