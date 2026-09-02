import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Checked synchronously so `describe.skipIf` can decide at module load time. */
export function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * A Prisma client is generated per datasource provider, so the PostgreSQL and
 * MySQL suites build theirs on demand instead of slowing every unit run down.
 */
export function generatePrismaClient(
  schema: string,
  output: string,
): new (
  options: unknown,
) => Record<string, (...args: never[]) => Promise<never>> {
  execSync(`pnpm exec prisma generate --schema=prisma/${schema}`, { stdio: "ignore" });
  return require(`../../node_modules/.prisma/${output}`).PrismaClient;
}
