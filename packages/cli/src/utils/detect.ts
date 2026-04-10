import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface DetectedStack {
	nextjs: string | null;
	typescript: boolean;
	drizzle: boolean;
	prisma: boolean;
	bullmq: boolean;
	betterAuth: { found: boolean; path: string | null };
	nextauth: boolean;
	clerk: boolean;
	trpc: { found: boolean; routerPath: string | null };
	dbImport: string | null;
}

export async function detectStack(cwd: string): Promise<DetectedStack> {
	const pkgPath = path.join(cwd, "package.json");
	// biome-ignore lint/suspicious/noExplicitAny: JSON parsed package.json
	let pkg: Record<string, any> = {};
	try {
		pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
	} catch {
		// no package.json
	}

	const allDeps = {
		...(pkg.dependencies ?? {}),
		...(pkg.devDependencies ?? {}),
		...(pkg.peerDependencies ?? {}),
	};

	let nextjs: string | null = null;
	if (allDeps.next) {
		const vMatch = String(allDeps.next).match(/(\d+)/);
		nextjs = vMatch?.[1] ?? "unknown";
	}

	let trpcRouterPath: string | null = null;
	const trpcCandidates = [
		"src/app/api/trpc/[trpc]/route.ts",
		"app/api/trpc/[trpc]/route.ts",
		"src/pages/api/trpc/[trpc].ts",
	];
	for (const candidate of trpcCandidates) {
		try {
			await fs.access(path.join(cwd, candidate));
			trpcRouterPath = candidate;
			break;
		} catch {}
	}

	const baCandidate = "src/shared/lib/auth/index.ts";
	let betterAuthPath: string | null = null;
	try {
		await fs.access(path.join(cwd, baCandidate));
		betterAuthPath = baCandidate;
	} catch {}

	return {
		nextjs,
		typescript: !!allDeps.typescript,
		drizzle: !!(allDeps["drizzle-orm"] || allDeps["drizzle-kit"]),
		prisma: !!allDeps["@prisma/client"],
		bullmq: !!allDeps.bullmq,
		betterAuth: { found: !!allDeps["better-auth"] || !!betterAuthPath, path: betterAuthPath },
		nextauth: !!allDeps["next-auth"],
		clerk: !!allDeps["@clerk/nextjs"],
		trpc: {
			found: !!(allDeps["@trpc/server"] || allDeps["@trpc/client"]),
			routerPath: trpcRouterPath,
		},
		dbImport: null,
	};
}
