import * as path from "node:path";
import { resolveProjectModule, validateProjectImport } from "../utils/module-path";
import { projectManifest } from "../utils/project-packages";
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
      check: (answer) => validateProjectImport(cwd, answer, clientExport),
    });
    if (orm === "drizzle") {
      schema = await askText({
        message: "Drizzle schema module, as an import path",
        initialValue: schema,
        check: (answer) => validateProjectImport(cwd, answer),
      });
    }
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
  if (!sessionStub && !authPlan) imports.push([auth, "getSession", "--auth", null]);
  const missingModules: MissingModule[] = [];
  for (const [specifier, exportName, flag, guess] of imports) {
    const problem = await validateProjectImport(cwd, specifier, exportName);
    if (!problem) continue;
    if (guess && (await resolveProjectModule(cwd, specifier)) === null) missingModules.push(guess);
    else run.fail(`Nothing was written. ${problem}\nUse ${flag} <module> to select your module.`);
  }
  if (missingModules.length > 0) run.fail(missingModuleMessage(missingModules, stack.pmc));

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
