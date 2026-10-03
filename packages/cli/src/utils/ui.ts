import { stripVTControlCharacters as bare } from "node:util";
import * as p from "@clack/prompts";

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
}

const silent: Ui = {
  intro: () => {},
  info: () => {},
  ok: () => {},
  warn: () => {},
  note: () => {},
  outro: () => {},
  cancel: () => {},
};

const framed: Ui = {
  intro: (title) => p.intro(title),
  info: (message) => p.log.info(message),
  ok: (message) => p.log.success(message),
  warn: (message) => p.log.warn(message),
  note: (body, title) => p.note(body, title),
  outro: (message) => p.outro(message),
  cancel: (message) => p.cancel(message.replaceAll("\n", "\n   ")),
};

const out = (line: string) => process.stdout.write(`${bare(line)}\n`);

const plain: Ui = {
  intro: () => {},
  info: (message) => out(`· ${message}`),
  ok: (message) => out(`✓ ${message}`),
  warn: (message) => out(`! ${message}`),
  note: (body, title) => out(`${title}\n${body.replace(/^/gm, "  ")}`),
  outro: (message) => out(message),
  cancel: (message) => process.stderr.write(`✗ ${bare(message)}\n`),
};

export function createUi(json: boolean | undefined): Ui {
  if (json) return silent;
  return process.stdout.isTTY ? framed : plain;
}
