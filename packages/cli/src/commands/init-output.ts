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

/** The files init refuses to overwrite, each with the content it would have written there. */
export function conflictMessage(files: ReadonlyArray<{ path: string; content: string }>): string {
  return [
    "Nothing was written. Move these files aside, or merge what init would write into them by hand:",
    ...files.flatMap((file) => [
      "",
      `  ${file.path}`,
      ...file.content
        .trimEnd()
        .split("\n")
        .map((line) => (line ? `    ${line}` : "")),
    ]),
    "",
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
  /** The Prisma client's module, as that file imports it. */
  client?: string;
}

const MODULE_NAMES: Record<MissingModule["kind"], string> = {
  db: "Drizzle client",
  schema: "Drizzle schema",
  prisma: "Prisma client",
};

/** The Drizzle driver the starting files are written for: the one installed, PostgreSQL's when none or several are. */
export type StarterDriver = "pg" | "mysql2" | "better-sqlite3";

interface Starter {
  db: string[];
  schema: string[];
  createTable: string;
  tool: string;
}

const UNSET_COMMENT =
  "// Without DATABASE_URL every query fails into the admin's error card instead of a blank page.";

const STARTERS: Record<StarterDriver, Starter> = {
  pg: {
    db: [
      'import { drizzle } from "drizzle-orm/node-postgres";',
      'import * as schema from "./db/schema";',
      "",
      UNSET_COMMENT,
      'const connectionString = process.env.DATABASE_URL || "postgresql://DATABASE_URL-is-not-set.invalid./db";',
      "",
      "export const db = drizzle({ connection: { connectionString }, schema });",
    ],
    schema: [
      'import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";',
      "",
      'export const users = pgTable("users", {',
      '  id: uuid("id").primaryKey().defaultRandom(),',
      '  email: text("email").notNull(),',
      '  createdAt: timestamp("created_at").notNull().defaultNow(),',
      "});",
    ],
    createTable:
      "CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, created_at timestamp NOT NULL DEFAULT now());",
    tool: "psql",
  },
  mysql2: {
    db: [
      'import { drizzle } from "drizzle-orm/mysql2";',
      'import * as schema from "./db/schema";',
      "",
      UNSET_COMMENT,
      'const uri = process.env.DATABASE_URL || "mysql://DATABASE_URL-is-not-set.invalid./db";',
      "",
      'export const db = drizzle({ connection: { uri }, schema, mode: "default" });',
    ],
    schema: [
      'import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";',
      "",
      'export const users = mysqlTable("users", {',
      '  id: int("id").primaryKey().autoincrement(),',
      '  email: varchar("email", { length: 255 }).notNull(),',
      '  createdAt: timestamp("created_at").notNull().defaultNow(),',
      "});",
    ],
    createTable:
      "CREATE TABLE users (id int AUTO_INCREMENT PRIMARY KEY, email varchar(255) NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    tool: "the mysql client",
  },
  "better-sqlite3": {
    db: [
      'import Database from "better-sqlite3";',
      'import { drizzle } from "drizzle-orm/better-sqlite3";',
      'import * as schema from "./db/schema";',
      "",
      'export const db = drizzle({ client: new Database("local.db"), schema });',
    ],
    schema: [
      'import { sql } from "drizzle-orm";',
      'import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";',
      "",
      'export const users = sqliteTable("users", {',
      '  id: integer("id").primaryKey({ autoIncrement: true }),',
      '  email: text("email").notNull(),',
      '  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),',
      "});",
    ],
    createTable:
      "CREATE TABLE users (id integer PRIMARY KEY AUTOINCREMENT, email text NOT NULL, created_at integer NOT NULL DEFAULT (unixepoch()));",
    tool: "sqlite3 local.db",
  },
};

function starterLines(entry: MissingModule, starter: Starter): string[] {
  const { kind } = entry;
  if (kind === "prisma") {
    return [
      `import { PrismaClient } from "${entry.client ?? "@prisma/client"}";`,
      "",
      "export const prisma = new PrismaClient();",
    ];
  }
  return kind === "db" ? starter.db : starter.schema;
}

/** What to do when the modules init guessed do not exist: starting files for the installed driver, or the flags that point at yours. */
export function missingModuleMessage(
  missing: readonly MissingModule[],
  pmc: PmCommands,
  driver: { name: StarterDriver; installed: boolean; unbuilt?: boolean } = {
    name: "pg",
    installed: false,
  },
): string {
  const starter = STARTERS[driver.name];
  const names = missing.map((entry) => MODULE_NAMES[entry.kind]).join(" and ");
  const flags = missing.map((entry) => `${entry.flag} <module>`).join(" and ");
  return [
    `Nothing was written. FlowPanel reads the database through your ${names}, and init found none.`,
    `Point init at yours with ${flags}, or create ${missing.length === 1 ? "this file" : "these files"}:`,
    ...missing.flatMap((entry) => [
      "",
      `  ${entry.file}`,
      ...starterLines(entry, starter).map((line) => (line ? `    ${line}` : "")),
      ...(entry.kind === "db" && !driver.installed
        ? ["", `  It needs the ${driver.name} driver: ${pmc.addDisplay(driver.name, false)}`]
        : []),
      ...(entry.kind === "db" && driver.unbuilt
        ? ["", `  ${driver.name} is not built yet: run pnpm approve-builds and select it.`]
        : []),
      ...(entry.kind === "schema"
        ? [
            "",
            `  Then create its table in your database, for example with ${starter.tool}:`,
            `    ${starter.createTable}`,
          ]
        : []),
    ]),
    "",
    `Guide: ${DOCS_URL}`,
  ].join("\n");
}
