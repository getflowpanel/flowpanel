import * as fs from "node:fs/promises";
import * as path from "node:path";
import { assertPlanHasNoConflicts } from "./filesystem-plan";
import type { FileOperation, FilesystemPlan } from "./types";

export interface TransactionHooks {
  /** Test seam invoked immediately before an operation is written. */
  beforeWrite?: (operation: FileOperation, index: number) => void | Promise<void>;
}

let tempSequence = 0;

async function atomicWrite(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.flowpanel-tmp-${process.pid}-${tempSequence++}`;
  try {
    await fs.writeFile(temp, content, "utf8");
    await fs.rename(temp, file);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}

/** Apply all writes atomically per file and restore earlier writes if any step fails. */
export async function applyFilesystemPlan(
  plan: FilesystemPlan,
  hooks: TransactionHooks = {},
): Promise<string[]> {
  assertPlanHasNoConflicts(plan);
  const changes = plan.operations.filter(
    (operation) => operation.kind === "create" || operation.kind === "modify",
  );
  const applied: FileOperation[] = [];

  try {
    for (const [index, operation] of changes.entries()) {
      await hooks.beforeWrite?.(operation, index);
      await atomicWrite(path.join(plan.cwd, operation.path), operation.content);
      applied.push(operation);
    }
  } catch (error) {
    for (const operation of applied.reverse()) {
      const file = path.join(plan.cwd, operation.path);
      if (operation.kind === "create") await fs.rm(file, { force: true });
      else await atomicWrite(file, operation.previousContent ?? "");
    }
    throw error;
  }

  return changes.map((operation) => operation.path);
}
