import { stripVTControlCharacters as bare } from "node:util";
import * as p from "@clack/prompts";
import { writeJson } from "./output";

/** A command's human output: clack frames on a terminal, plain marked lines in a pipe, nothing under --json. */
export interface Ui {
  intro(title: string): void;
  info(message: string): void;
  ok(message: string): void;
  warn(message: string): void;
  note(body: string, title: string): void;
  outro(message: string): void;
  /** Stops with `message`; extra lines stay inside the clack frame. */
  cancel(message: string): void;
  /** A slow step: a spinner on a terminal, a start line and an outcome line in a pipe. */
  step(message: string): Step;
}

export interface Step {
  done(message: string): void;
  failed(message: string): void;
}

const quietStep: Step = { done: () => {}, failed: () => {} };

const silent: Ui = {
  intro: () => {},
  info: () => {},
  ok: () => {},
  warn: () => {},
  note: () => {},
  outro: () => {},
  cancel: () => {},
  step: () => quietStep,
};

const framed: Ui = {
  intro: (title) => p.intro(title),
  info: (message) => p.log.info(message),
  ok: (message) => p.log.success(message),
  warn: (message) => p.log.warn(message),
  note: (body, title) => p.note(body, title),
  outro: (message) => p.outro(message),
  cancel: (message) => p.cancel(message.replaceAll("\n", "\n   ")),
  step: (message) => {
    const spinner = p.spinner();
    spinner.start(message);
    return { done: (end) => spinner.stop(end), failed: (end) => spinner.stop(end) };
  },
};

/** Plain lines; a titled block and the closing line start after a blank line unless they come first. */
function plainUi(): Ui {
  let printed = false;
  let afterBlock = false;
  const out = (line: string) => {
    process.stdout.write(`${afterBlock ? "\n" : ""}${bare(line)}\n`);
    printed = true;
    afterBlock = false;
  };
  const apart = (text: string) => {
    const lead = printed && !afterBlock ? "\n" : "";
    out(`${lead}${text}`);
    afterBlock = true;
  };
  return {
    intro: () => {},
    info: (message) => out(`· ${message}`),
    ok: (message) => out(`✓ ${message}`),
    warn: (message) => out(`! ${message}`),
    note: (body, title) => apart(`${title}\n${body.replace(/^/gm, "  ")}`),
    outro: (message) => apart(message),
    cancel: (message) => process.stderr.write(`✗ ${bare(message)}\n`),
    step: (message) => {
      out(`· ${message}`);
      return {
        done: (end) => out(`✓ ${end}`),
        failed: (end) => process.stderr.write(`✗ ${bare(end)}\n`),
      };
    },
  };
}

export function createUi(json: boolean | undefined): Ui {
  if (json) return silent;
  return process.stdout.isTTY ? framed : plainUi();
}

/** Stops a command with exit code 1: `{ command, applied: false, error }` under --json, a cancel line otherwise. */
export function failCommand(
  command: string,
  json: boolean | undefined,
  message: string,
  payload: Record<string, unknown> = { applied: false },
): never {
  if (json) writeJson({ command, ...payload, error: message });
  else createUi(false).cancel(message);
  process.exit(1);
}
