import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveProjectModule, validateProjectImport } from "../utils/module-path";
import { detectClientGenerator, prismaClientModule } from "../utils/prisma-provider";
import {
  projectManifest,
  readPackageManifest,
  resolvePackageDirectory,
} from "../utils/project-packages";
import { dialectFromDependencies, drizzleDialectFrom, type SqlDialect } from "../utils/sql-dialect";
import {
  type AuthSessionPlan,
  type DevStubReplacement,
  planAuthSession,
  planDevStubReplacement,
} from "./init-auth";
import type { InitRun } from "./init-context";
import { type DetectedStack, guessedDbFile, guessedFile, guessedSchemaFile } from "./init-detect";
import { customisedSessionMessage, type MissingModule, missingModuleMessage } from "./init-output";
import {
  askDevAuth,
  askText,
  authAnswerCheck,
  shouldAskDevAuth,
  writesSessionStub,
} from "./init-prompts";

/** The modules the config imports and the session init writes, as answered or detected. */
export interface InitModules {
  appName: string;
  db: string;
  schema: string;
  auth: string;
  /** A provider preset init writes instead of asking for `getSession`. */
  authPlan: AuthSessionPlan | null;
  /** Nothing exports `getSession`, so init writes the session stub. */
  sessionStub: boolean;
  devAuth: boolean;
  /** `--dev-auth` swaps one of init's own stubs for the development identity. */
  sessionReplacement: Extract<DevStubReplacement, { kind: "replace" }> | null;
  dialect: SqlDialect;
  /** Drizzle gave no hint of the database, so the migration is PostgreSQL. */
  dialectGuessed: boolean;
}

/** The driver init's starting files use: mysql2 or better-sqlite3 when that is the one installed, pg otherwise. */
async function starterDriver(cwd: string, pm: string) {
  const [pg, mysql2, sqlite] = await Promise.all(
    ["pg", "mysql2", "better-sqlite3"].map((name) => resolvePackageDirectory(cwd, name)),
  );
  if (!pg && mysql2) return { name: "mysql2" as const, installed: true };
  if (!pg && !mysql2 && sqlite) {
    // Before 13 its native module comes from an install script, which pnpm 10 skips until approved.
    const install = (await readPackageManifest(path.join(sqlite, "package.json")))?.scripts
      ?.install;
    const binding = path.join(sqlite, "build/Release/better_sqlite3.node");
    const unbuilt = pm === "pnpm" && !!install && !(await fs.stat(binding).catch(() => null));
    return { name: "better-sqlite3" as const, installed: true, unbuilt };
  }
  return { name: "pg" as const, installed: pg !== null };
}

/** Asks for the app name and each module unless the run is unattended, then checks every import resolves. */
export async function chooseModules(run: InitRun, stack: DetectedStack): Promise<InitModules> {
  const { cwd, opts } = run;
  const { orm, detected, guesses } = stack;
  let authPlan = opts.auth
    ? null
    : await planAuthSession({
        cwd,
        provider: stack.authProvider,
        detectedAuth: detected.auth,
        aliasMode: stack.aliasMode,
        devAuth: !!opts.devAuth,
      });
  const clientExport = orm === "prisma" ? "prisma" : "db";
  let appName = path.basename(cwd);
  let db = opts.db ?? detected.db ?? guesses.db;
  let schema = opts.schema ?? detected.schema ?? guesses.schema;
  let auth = opts.auth ?? authPlan?.specifier ?? detected.auth ?? guesses.auth;

  // The guessed path with no file behind it passes, so init stops below and prints a starting file.
  const missingGuess = async (answer: string, guess: string) =>
    answer === guess && (await resolveProjectModule(cwd, answer)) === null;
  if (!run.unattended) {
    appName = await askText({
      message: "App name, shown as the sidebar brand",
      initialValue: appName,
    });
    db = await askText({
      message:
        orm === "prisma"
          ? "Prisma client module, as an import path (exports prisma)"
          : "Drizzle client module, as an import path (exports db)",
      initialValue: db,
      check: async (answer) =>
        (await missingGuess(answer, guesses.db))
          ? null
          : validateProjectImport(cwd, answer, clientExport),
    });
    if (orm === "drizzle") {
      schema = await askText({
        message: "Drizzle schema module, as an import path",
        initialValue: schema,
        check: async (answer) =>
          (await missingGuess(answer, guesses.schema)) ? null : validateProjectImport(cwd, answer),
      });
    }
  }

  const imports: Array<[string, string | undefined, string, MissingModule | null]> = [
    [
      db,
      clientExport,
      "--db",
      db === guesses.db
        ? {
            kind: clientExport,
            file: guessedFile(guessedDbFile(orm), stack.aliasMode),
            flag: "--db",
            ...(orm === "prisma"
              ? {
                  client: prismaClientModule(
                    await detectClientGenerator(cwd),
                    guessedFile(guessedDbFile(orm), stack.aliasMode),
                    stack.aliasMode,
                  ),
                }
              : {}),
          }
        : null,
    ],
  ];
  if (orm === "drizzle") {
    imports.push([
      schema,
      undefined,
      "--schema",
      schema === guesses.schema
        ? { kind: "schema", file: guessedSchemaFile(stack.aliasMode), flag: "--schema" }
        : null,
    ]);
  }
  const missingModules: MissingModule[] = [];
  for (const [specifier, exportName, flag, guess] of imports) {
    const problem = await validateProjectImport(cwd, specifier, exportName);
    if (!problem) continue;
    if (guess && (await resolveProjectModule(cwd, specifier)) === null) missingModules.push(guess);
    else run.fail(`Nothing was written. ${problem}\nUse ${flag} <module> to select your module.`);
  }
  if (missingModules.length > 0) {
    run.fail(missingModuleMessage(missingModules, stack.pmc, await starterDriver(cwd, stack.pm)));
  }

  if (!run.unattended) {
    auth = await askText({
      message: "Session module, as an import path (exports getSession)",
      initialValue: auth,
      check: authAnswerCheck({
        plannedSession: authPlan?.specifier ?? null,
        detectedAuth: detected.auth,
        guessedAuth: guesses.auth,
        validate: (answer) => validateProjectImport(cwd, answer, "getSession"),
      }),
    });
  }

  if (authPlan && auth !== authPlan.specifier) authPlan = null;
  const sessionStub = writesSessionStub({
    detectedAuth: detected.auth,
    guessedAuth: guesses.auth,
    answer: auth,
  });
  let devAuth = !!opts.devAuth;
  if (shouldAskDevAuth({ unattended: run.unattended, sessionStub, devAuth })) {
    devAuth = await askDevAuth();
  }

  if (!sessionStub && !authPlan) {
    const problem = await validateProjectImport(cwd, auth, "getSession");
    if (problem)
      run.fail(`Nothing was written. ${problem}\nUse --auth <module> to select your module.`);
  }

  const replacement =
    devAuth && !sessionStub && !opts.auth ? await planDevStubReplacement(cwd, auth) : null;
  if (replacement?.kind === "customised") {
    run.fail(customisedSessionMessage(replacement.file, false));
  }

  const manifest = await projectManifest(cwd);
  const drizzleDialect =
    orm === "drizzle"
      ? ((await drizzleDialectFrom(cwd, [schema, db])) ??
        dialectFromDependencies({ ...manifest?.dependencies, ...manifest?.devDependencies }))
      : null;
  return {
    appName,
    db,
    schema,
    auth,
    authPlan,
    sessionStub,
    devAuth,
    sessionReplacement: replacement,
    dialect: orm === "prisma" ? stack.prismaProvider : (drizzleDialect ?? "postgresql"),
    dialectGuessed: orm === "drizzle" && drizzleDialect === null,
  };
}
