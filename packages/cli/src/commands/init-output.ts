import pc from "picocolors";
import type { PmCommands } from "../utils/detect";

export const DOCS_URL = "https://flowpanel.tech/docs/introduction/getting-started";
const DEV_PORT = 3000;

export function adminUrl(adminPath: string): string {
  return `http://localhost:${DEV_PORT}${adminPath}`;
}

/** Word-wraps `text` to `width` columns, so a long notice never breaks mid-word in a terminal. */
export function wrapWords(text: string, width: number): string {
  return text
    .split("\n")
    .map((paragraph) => {
      const lines: string[] = [];
      let line = "";
      for (const word of paragraph.split(" ")) {
        if (line && line.length + word.length + 1 > width) {
          lines.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      lines.push(line);
      return lines.join("\n");
    })
    .join("\n");
}

/** The rows of the closing "Next" block: one command and what it is for, aligned. */
export function nextSteps(
  pmc: PmCommands,
  colors: Pick<typeof pc, "cyan" | "dim"> = pc,
  noun: "table" | "model" = "table",
): string {
  const rows: Array<[command: string, purpose: string]> = [
    [`${pmc.exec} flowpanel new <${noun}>`, "add a resource to flowpanel.config.ts"],
    [`${pmc.run} dev`, "start Next.js and open the admin URL below"],
    [
      `${pmc.exec} flowpanel migrate`,
      "only if you turn on the audit log: creates flowpanel_audit_log",
    ],
  ];
  const width = Math.max(...rows.map(([command]) => command.length)) + 4;
  return [
    ...rows.map(
      ([command, purpose]) =>
        `${colors.cyan(command)}${" ".repeat(width - command.length)}${colors.dim(purpose)}`,
    ),
    colors.dim(DOCS_URL),
  ].join("\n");
}

export type AuthOutcome =
  | { kind: "closed-stub"; file: string }
  | { kind: "dev-stub"; file: string }
  | { kind: "preset"; file: string; provider: string }
  | { kind: "existing" };

export function authNotice(outcome: AuthOutcome, pmc: PmCommands): string | null {
  switch (outcome.kind) {
    case "closed-stub":
      return `${outcome.file} returns no session, so the admin denies every request. Return your provider's session from getSession there, or run ${pmc.exec} flowpanel init --dev-auth for an open development identity.`;
    case "dev-stub":
      return `${outcome.file} signs every request in as an admin in development and throws under \`next start\`. Replace it with your auth provider before deploying.`;
    case "preset":
      return `Recognised ${outcome.provider}: ${outcome.file} builds on the matching preset. Set its role option to your own roles before deploying.`;
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

export const DEV_AUTH_IN_CONFIG =
  'put auth: devAuth() in flowpanel.config.ts (import { devAuth } from "@flowpanel/kit")';

/** Why `--dev-auth` leaves a session module alone, and what to change instead. */
export function customisedSessionMessage(file: string, initialised: boolean): string {
  return initialised
    ? `Nothing was written. ${file} is your own session module, so --dev-auth leaves it alone. To open the admin while you develop, return a session from getSession there, or ${DEV_AUTH_IN_CONFIG}.`
    : `Nothing was written. ${file} already exports getSession, so --dev-auth leaves it alone. Run init without --dev-auth to use it; to open the admin while you develop, then ${DEV_AUTH_IN_CONFIG}.`;
}

export const PROVIDER_FALLBACK_WARNING =
  'Could not read the datasource provider from your Prisma schema; wrote provider: "postgresql" in flowpanel.config.ts. Change it if your database is MySQL or SQLite.';

export function unsupportedProviderMessage(provider: string): string {
  return `Nothing was written. prismaAdapter supports postgresql, mysql and sqlite; your Prisma schema uses ${provider}.`;
}

export function noOrmMessage(pmc: PmCommands): string {
  return `No ORM found in package.json. Add Drizzle with PostgreSQL (${pmc.addDisplay("drizzle-orm@0 pg", false)} and ${pmc.addDisplay("@types/pg", true)}) or Prisma 6 (${pmc.addDisplay("@prisma/client@6", false)} and ${pmc.addDisplay("prisma@6", true)}), then run init again.`;
}

export interface MissingModule {
  kind: "db" | "schema" | "prisma";
  /** Project-relative file the guessed specifier would resolve to. */
  file: string;
  flag: string;
}

const MODULE_NAMES: Record<MissingModule["kind"], string> = {
  db: "Drizzle client",
  schema: "Drizzle schema",
  prisma: "Prisma client",
};

const STARTER_MODULES: Record<MissingModule["kind"], string[]> = {
  db: [
    'import { drizzle } from "drizzle-orm/node-postgres";',
    'import * as schema from "./db/schema";',
    "",
    "export const db = drizzle({ connection: { connectionString: process.env.DATABASE_URL }, schema });",
  ],
  schema: [
    'import { pgTable, text, timestamp } from "drizzle-orm/pg-core";',
    "",
    'export const users = pgTable("users", {',
    '  id: text("id").primaryKey(),',
    '  email: text("email").notNull(),',
    '  createdAt: timestamp("created_at").notNull().defaultNow(),',
    "});",
  ],
  prisma: [
    'import { PrismaClient } from "@prisma/client";',
    "",
    "export const prisma = new PrismaClient();",
  ],
};

const USERS_TABLE =
  "CREATE TABLE users (id text PRIMARY KEY, email text NOT NULL, created_at timestamp NOT NULL DEFAULT now());";

/** What to do when the modules init guessed do not exist: starting files, or the flags that point at yours. */
export function missingModuleMessage(
  missing: readonly MissingModule[],
  pmc: PmCommands,
  installed: { pg: boolean } = { pg: false },
): string {
  const names = missing.map((entry) => MODULE_NAMES[entry.kind]).join(" and ");
  const flags = missing.map((entry) => `${entry.flag} <module>`).join(" and ");
  return [
    `Nothing was written. FlowPanel reads the database through your ${names}, and init found none.`,
    `Point init at yours with ${flags}, or create ${missing.length === 1 ? "this file" : "these files"}:`,
    ...missing.flatMap((entry) => [
      "",
      `  ${entry.file}`,
      ...STARTER_MODULES[entry.kind].map((line) => (line ? `    ${line}` : "")),
      ...(entry.kind === "db" && !installed.pg
        ? ["", `  It needs the pg driver: ${pmc.addDisplay("pg", false)}`]
        : []),
      ...(entry.kind === "schema"
        ? [
            "",
            "  Then create its table in your database, for example with psql:",
            `    ${USERS_TABLE}`,
          ]
        : []),
    ]),
    "",
    `Guide: ${DOCS_URL}`,
  ].join("\n");
}
