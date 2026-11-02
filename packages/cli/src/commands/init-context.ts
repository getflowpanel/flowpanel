import * as p from "@clack/prompts";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FilesystemPlan } from "../plan/types";
import { planLines } from "../utils/output";
import { createUi, failCommand, type Ui } from "../utils/ui";
import { wrapWords } from "./init-output";
import { ABORTED, abortOnCancel } from "./init-prompts";

export interface InitOptions {
  yes?: boolean;
  dryRun?: boolean;
  json?: boolean;
  path?: string;
  db?: string;
  schema?: string;
  auth?: string;
  devAuth?: boolean;
}

/** What every init phase shares: where it runs, how it talks, and how it stops. */
export interface InitRun {
  cwd: string;
  opts: InitOptions;
  /** No questions: `--yes`, `--dry-run` or `--json`. */
  unattended: boolean;
  /** Clack frames on a terminal, rather than plain lines in a pipe or JSON. */
  framed: boolean;
  ui: Ui;
  fail: (message: string, payload?: Record<string, unknown>) => never;
}

export function createInitRun(opts: InitOptions): InitRun {
  return {
    cwd: process.cwd(),
    opts,
    unattended: Boolean(opts.yes || opts.dryRun || opts.json),
    framed: !opts.json && Boolean(process.stdout.isTTY),
    ui: createUi(opts.json),
    fail: (message, payload) => failCommand("init", opts.json, message, payload),
  };
}

/** A notice word-wrapped to the terminal, so it never breaks mid-word; as is in a pipe. */
export function wrapNotice(run: InitRun, text: string): string {
  if (!run.framed) return text;
  return wrapWords(text, Math.max(40, Math.min(process.stdout.columns ?? 80, 100) - 4));
}

/** Prints the plan and, unless the run is unattended, asks before writing; the files written, or `null` when declined. */
export async function confirmAndApply(
  run: InitRun,
  plan: FilesystemPlan,
  ask: boolean,
): Promise<string[] | null> {
  if (ask && !run.unattended) {
    run.ui.note(planLines(plan), "Filesystem plan");
    const confirmed = abortOnCancel(
      await p.confirm({ message: "Apply these changes?", initialValue: true }),
    );
    if (!confirmed) {
      p.cancel(ABORTED);
      return null;
    }
  }
  return applyFilesystemPlan(plan);
}
