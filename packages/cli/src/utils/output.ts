import { publicPlan } from "../plan/filesystem-plan";
import type { FilesystemPlan } from "../plan/types";

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writePlanJson(command: string, plan: FilesystemPlan, applied: boolean): void {
  writeJson({ command, applied, plan: publicPlan(plan) });
}
