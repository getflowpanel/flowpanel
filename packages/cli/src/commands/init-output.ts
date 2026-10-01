import pc from "picocolors";
import type { PmCommands } from "../utils/detect";

const DOCS_URL = "https://flowpanel.tech/docs/introduction/getting-started";
const DEV_PORT = 3000;

export function nextSteps(
  pmc: PmCommands,
  adminPath: string,
  colors: Pick<typeof pc, "cyan" | "dim"> = pc,
  noun: "table" | "model" = "table",
): string {
  const rows: Array<[command: string, purpose: string]> = [
    [`${pmc.exec} flowpanel new <${noun}>`, "add a resource to flowpanel.config.ts"],
    [`${pmc.run} dev`, `start Next.js, then open http://localhost:${DEV_PORT}${adminPath}`],
  ];
  const width = Math.max(...rows.map(([command]) => command.length)) + 4;
  return [
    "Next",
    ...rows.map(
      ([command, purpose]) =>
        `  ${colors.cyan(command)}${" ".repeat(width - command.length)}${colors.dim(purpose)}`,
    ),
    `  ${DOCS_URL}`,
  ].join("\n");
}

export type AuthOutcome =
  | { kind: "closed-stub"; file: string }
  | { kind: "dev-stub"; file: string }
  | { kind: "preset"; file: string; provider: string }
  | { kind: "existing" };

export function authNotice(outcome: AuthOutcome): string | null {
  switch (outcome.kind) {
    case "closed-stub":
      return `Authentication: ${outcome.file} returns no session, so the admin denies every request until you connect your provider.`;
    case "dev-stub":
      return `Authentication: ${outcome.file} is an open development identity. Replace it before deploying.`;
    case "preset":
      return `Authentication: recognised ${outcome.provider}. ${outcome.file} builds on the matching preset; set its role option to your own roles before deploying.`;
    case "existing":
      return null;
  }
}

export function conflictMessage(paths: readonly string[]): string {
  return [
    "Nothing was written. Move these files aside, or merge the generated changes into them by hand:",
    ...paths.map((file) => `  ${file}`),
    "FlowPanel does not overwrite files it did not write.",
  ].join("\n");
}

export function customisedSessionMessage(file: string): string {
  return `${file} is already customised; edit it to return a session, or remove it and re-run init --dev-auth.`;
}

export const PROVIDER_FALLBACK_WARNING =
  'Could not read the datasource provider from your Prisma schema; wrote provider: "postgresql" in flowpanel.config.ts. Change it if your database is MySQL or SQLite.';

export function unsupportedProviderMessage(provider: string): string {
  return `Nothing was written. prismaAdapter supports postgresql, mysql and sqlite; your Prisma schema uses ${provider}.`;
}
