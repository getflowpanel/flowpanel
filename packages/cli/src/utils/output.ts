import { publicPlan } from "../plan/filesystem-plan.js";
import type { FilesystemPlan } from "../plan/types.js";

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writePlanJson(command: string, plan: FilesystemPlan, applied: boolean): void {
  writeJson({ command, applied, plan: publicPlan(plan) });
}
