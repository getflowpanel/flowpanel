import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findAdminConfig } from "../scaffold/config-target";
import type { PathAliasMode } from "../utils/detect";
import { resolveProjectModule } from "../utils/module-path";
import { detectClientGenerator, prismaClientModule } from "../utils/prisma-provider";
import type { Check } from "./check";

const PRISMA_IMPORT = /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*["']([^"']+)["']/;
const NAME = "Prisma client import matches the generator";

/** Fails when the client module the config imports reads `@prisma/client` while the schema generates the client elsewhere. */
export async function prismaClientCheck(cwd: string, mode: PathAliasMode): Promise<Check[]> {
  const generator = await detectClientGenerator(cwd);
  const config = await findAdminConfig(cwd);
  if (!generator?.output || !config) return [];
  const source = await fs.readFile(config.file, "utf8").catch(() => "");
  const specifier = PRISMA_IMPORT.exec(source)?.[1];
  const file = specifier ? await resolveProjectModule(cwd, specifier, config.file) : null;
  if (!file) return [];
  const client = await fs.readFile(file, "utf8").catch(() => "");
  if (!/from\s+["']@prisma\/client["']/.test(client)) return [{ name: NAME, ok: true }];
  const module = path.relative(cwd, file).split(path.sep).join("/");
  const expected = prismaClientModule(generator, module, mode);
  return [
    {
      name: NAME,
      ok: false,
      hint: `${generator.file} uses the ${generator.provider} generator (output "${generator.output.written}"), but ${module} imports @prisma/client. Import PrismaClient from "${expected}" instead.`,
    },
  ];
}
