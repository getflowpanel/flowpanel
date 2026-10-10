import pc from "picocolors";
import { type AdminConfigFile, findAdminConfig } from "../scaffold/config-target";
import { type AuthProvider, detectAuthProvider } from "../utils/auth-provider";
import { firstCompatibilityFailure, inspectProjectCompatibility } from "../utils/compatibility";
import {
  aliasOf,
  detectAuth,
  detectDbClient,
  detectPackageManagerDetails,
  detectPathAlias,
  detectSchema,
  type PackageManager,
  type PathAliasMode,
  type PmCommands,
  pmCommands,
} from "../utils/detect";
import { kitCompatibilityError } from "../utils/kit";
import { detectPrismaProvider, type PrismaProvider } from "../utils/prisma-provider";
import { noNextProject } from "../utils/project-root";
import type { InitRun } from "./init-context";
import { noOrmMessage, unsupportedProviderMessage } from "./init-output";

export type Orm = "drizzle" | "prisma";

/** The project init runs in, before anything is detected about its stack. */
export interface InitProject {
  pm: PackageManager;
  pmc: PmCommands;
  existingConfig: AdminConfigFile | null;
}

/** Everything init reads from the project before it asks a question. */
export interface DetectedStack extends InitProject {
  orm: Orm;
  prismaProvider: PrismaProvider;
  /** The Prisma schema names no provider, so the config says `postgresql`. */
  providerGuessed: boolean;
  authProvider: AuthProvider | null;
  aliasMode: PathAliasMode;
  detected: { db: string | null; schema: string | null; auth: string | null };
  guesses: { db: string; schema: string; auth: string };
}

const GUESSED_AUTH_FILE = "server/lib/auth.ts";
const GUESSED_SCHEMA_FILE = "server/lib/db/schema.ts";

export function guessedDbFile(orm: Orm): string {
  return orm === "prisma" ? "lib/prisma.ts" : "server/lib/db.ts";
}

/**
 * Import specifiers the generated config falls back to when nothing matched on
 * disk. Without an `@/*` alias the guess has to be relative, or it cannot resolve.
 */
export function guessedPaths(
  orm: Orm,
  aliasMode: PathAliasMode,
): { db: string; schema: string; auth: string } {
  return {
    db: aliasOf(guessedDbFile(orm), aliasMode),
    schema: aliasOf(GUESSED_SCHEMA_FILE, aliasMode),
    auth: aliasOf(GUESSED_AUTH_FILE, aliasMode),
  };
}

/** Project-relative file a guessed specifier resolves to. */
export function guessedFile(relPath: string, aliasMode: PathAliasMode): string {
  return aliasMode === "strip-src" ? `src/${relPath}` : relPath;
}

export function guessedSchemaFile(aliasMode: PathAliasMode): string {
  return guessedFile(GUESSED_SCHEMA_FILE, aliasMode);
}

/** Project-relative file the guessed `auth` specifier resolves to. */
export function guessedAuthFile(aliasMode: PathAliasMode): string {
  return guessedFile(GUESSED_AUTH_FILE, aliasMode);
}

/** A terminal for questions, a package manager, a Next.js project; and the config, if init ran before. */
export async function findInitProject(run: InitRun): Promise<InitProject> {
  if (!run.unattended && !process.stdin.isTTY) {
    run.fail(
      "init asks questions and this run has no interactive terminal. Re-run with --yes to accept the detected defaults.",
    );
  }
  const detection = await detectPackageManagerDetails(run.cwd);
  if (detection.error) run.fail(detection.error);
  run.ui.intro(pc.bgCyan(pc.black(" FlowPanel init ")));
  const notProject = await noNextProject(run.cwd);
  if (notProject) run.fail(notProject);
  return {
    pm: detection.manager,
    pmc: pmCommands(detection.manager),
    existingConfig: await findAdminConfig(run.cwd),
  };
}

/** Supported versions, one ORM, a matching kit, and the modules the config will import. */
export async function detectStack(run: InitRun, project: InitProject): Promise<DetectedStack> {
  const { cwd } = run;
  const compatibility = await inspectProjectCompatibility(cwd);
  const prerequisiteFailure = firstCompatibilityFailure(
    compatibility.findings.filter(
      (finding) => !["drizzle-orm", "@prisma/client"].includes(finding.name),
    ),
  );
  if (prerequisiteFailure) run.fail(prerequisiteFailure);
  const selectedOrm = compatibility.ormFinding;
  if (compatibility.orm === null || selectedOrm === null) run.fail(noOrmMessage(project.pmc));
  if (!selectedOrm.ok) {
    run.fail(firstCompatibilityFailure([selectedOrm]) ?? "The selected ORM is unsupported.");
  }
  const kitMismatch = await kitCompatibilityError(cwd);
  if (kitMismatch) run.fail(kitMismatch);

  const orm: Orm = compatibility.orm;
  const providerLookup = orm === "prisma" ? await detectPrismaProvider(cwd) : null;
  if (providerLookup?.status === "unsupported") {
    run.fail(unsupportedProviderMessage(providerLookup.provider));
  }
  const authProvider = await detectAuthProvider(cwd);
  const observed = (name: string) =>
    compatibility.findings.find((finding) => finding.name === name)?.observed;
  const stack = [
    `Next.js ${observed("next")}`,
    `React ${observed("react")}`,
    "TypeScript",
    orm === "drizzle" ? "Drizzle" : "Prisma",
    ...(authProvider ? [authProvider] : []),
  ];
  if (run.framed) run.ui.note(stack.join(" · "), "Detected stack");

  const aliasMode = await detectPathAlias(cwd);
  return {
    ...project,
    orm,
    prismaProvider: providerLookup?.status === "found" ? providerLookup.provider : "postgresql",
    providerGuessed: providerLookup?.status === "missing",
    authProvider,
    aliasMode,
    detected: {
      db: await detectDbClient(cwd, aliasMode),
      schema: await detectSchema(cwd, aliasMode),
      auth: await detectAuth(cwd, aliasMode),
    },
    guesses: guessedPaths(orm, aliasMode),
  };
}
