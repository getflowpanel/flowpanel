import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  FileIntent,
  FileOperation,
  FileOperationKind,
  FilesystemPlan,
  PublicFilesystemPlan,
} from "./types";

function normalizeRelativePath(input: string): string {
  const normalized = path.normalize(input);
  if (
    !input ||
    path.isAbsolute(input) ||
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`Unsafe project path: ${input || "<empty>"}`);
  }
  // Planned paths are reported and compared, so they stay POSIX on every host.
  return normalized.split(path.sep).join("/");
}

async function readExisting(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Classify every intended write before any file is changed. */
export async function createFilesystemPlan(
  cwd: string,
  intents: readonly FileIntent[],
): Promise<FilesystemPlan> {
  const seen = new Set<string>();
  const operations: FileOperation[] = [];

  for (const intent of intents) {
    const relative = normalizeRelativePath(intent.path);
    if (seen.has(relative)) throw new Error(`Duplicate planned path: ${relative}`);
    seen.add(relative);

    const previousContent = await readExisting(path.join(cwd, relative));
    if (previousContent === null) {
      operations.push({ kind: "create", path: relative, content: intent.content });
      continue;
    }
    if (previousContent === intent.content) {
      operations.push({
        kind: "skip",
        path: relative,
        content: intent.content,
        reason: "unchanged",
      });
      continue;
    }

    const expectedMatches =
      intent.expectedContent !== undefined && previousContent === intent.expectedContent;
    if (intent.overwrite || expectedMatches) {
      operations.push({
        kind: "modify",
        path: relative,
        content: intent.content,
        previousContent,
      });
      continue;
    }

    operations.push({
      kind: "conflict",
      path: relative,
      content: intent.content,
      previousContent,
      reason: "existing file differs",
    });
  }

  return { version: 1, cwd: path.resolve(cwd), operations };
}

export function publicPlan(plan: FilesystemPlan): PublicFilesystemPlan {
  const summary: Record<FileOperationKind, number> = {
    create: 0,
    modify: 0,
    skip: 0,
    conflict: 0,
  };
  const operations = plan.operations.map(({ kind, path: file, reason }) => {
    summary[kind]++;
    return reason ? { kind, path: file, reason } : { kind, path: file };
  });
  return { version: 1, operations, summary };
}

export function assertPlanHasNoConflicts(plan: FilesystemPlan): void {
  const conflicts = plan.operations.filter((operation) => operation.kind === "conflict");
  if (conflicts.length === 0) return;
  throw new Error(
    `Refusing to overwrite ${conflicts.map((operation) => operation.path).join(", ")}. ` +
      "Move the file, make the change manually, or explicitly allow replacement.",
  );
}
