import { publicPlan } from "../plan/filesystem-plan";
import type { FilesystemPlan } from "../plan/types";

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writePlanJson(
  command: string,
  plan: FilesystemPlan,
  applied: boolean,
  extra: Record<string, unknown> = {},
): void {
  writeJson({ command, applied, plan: publicPlan(plan), ...extra });
}

/** Exits once stdout has flushed: a database pool the config opened would otherwise keep the process alive. */
export function exitAfterFlush(code: number): Promise<void> {
  return new Promise(() => {
    process.stdout.write("", () => process.exit(code));
  });
}
