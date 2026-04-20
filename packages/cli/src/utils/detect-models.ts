import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface DetectedModels {
  source: "prisma" | "drizzle" | null;
  schemaPath: string | null;
  models: string[];
}

/**
 * Detect user models in a consumer project by scanning common locations for
 * Prisma (schema.prisma) or Drizzle (*.ts with pgTable/sqliteTable/mysqlTable).
 */
export async function detectModels(cwd: string): Promise<DetectedModels> {
  // Try Prisma first (most common)
  const prismaCandidates = ["prisma/schema.prisma", "schema.prisma", "db/schema.prisma"];
  for (const rel of prismaCandidates) {
    const full = path.join(cwd, rel);
    try {
      const content = await fs.readFile(full, "utf8");
      return {
        source: "prisma",
        schemaPath: rel,
        models: parsePrismaModels(content),
      };
    } catch {
      // try next
    }
  }

  // Try Drizzle schema files
  const drizzleCandidates = [
    "src/db/schema.ts",
    "src/shared/lib/db/schema.ts",
    "drizzle/schema.ts",
    "db/schema.ts",
    "src/lib/db/schema.ts",
  ];
  for (const rel of drizzleCandidates) {
    const full = path.join(cwd, rel);
    try {
      const content = await fs.readFile(full, "utf8");
      const models = parseDrizzleModels(content);
      if (models.length > 0) {
        return { source: "drizzle", schemaPath: rel, models };
      }
    } catch {
      // try next
    }
  }

  return { source: null, schemaPath: null, models: [] };
}

/**
 * Extract model names from a Prisma schema.
 * Matches `model Foo {` declarations, ignores views/datasources/enums.
 */
export function parsePrismaModels(content: string): string[] {
  const modelRegex = /^\s*model\s+(\w+)\s*\{/gm;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(content)) !== null) {
    names.push(match[1]!);
  }
  return names;
}

/**
 * Extract table exports from a Drizzle schema file.
 * Matches: `export const foo = pgTable(...)` / sqliteTable / mysqlTable.
 */
export function parseDrizzleModels(content: string): string[] {
  const tableRegex =
    /export\s+const\s+(\w+)\s*=\s*(?:pg|sqlite|mysql)Table\s*\(\s*["']([^"']+)["']/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(content)) !== null) {
    names.push(match[1]!);
  }
  return names;
}
