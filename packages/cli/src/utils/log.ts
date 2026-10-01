import pc from "picocolors";

export const log = {
  info: (m: string) => process.stdout.write(`${pc.cyan("·")} ${m}\n`),
  ok: (m: string) => process.stdout.write(`${pc.green("✓")} ${m}\n`),
  warn: (m: string) => process.stdout.write(`${pc.yellow("!")} ${m}\n`),
  err: (m: string) => process.stderr.write(`${pc.red("✗")} ${m}\n`),
  dim: (m: string) => process.stdout.write(`${pc.dim(m)}\n`),
};

/** The same markers without colour, for output that is not a terminal. */
export const plainLog = {
  info: (m: string) => process.stdout.write(`· ${m}\n`),
  ok: (m: string) => process.stdout.write(`✓ ${m}\n`),
  warn: (m: string) => process.stdout.write(`! ${m}\n`),
  err: (m: string) => process.stderr.write(`✗ ${m}\n`),
};
