import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function resolveTemplatesDir(): Promise<string> {
  const candidates = [
    path.join(HERE, "templates"), // dist/templates (bundled)
    path.join(HERE, "..", "templates"), // src/templates (tests/dev, HERE = src/utils)
  ];
  for (const dir of candidates) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      // keep looking
    }
  }
  throw new Error(`FlowPanel CLI templates not found. Tried: ${candidates.join(", ")}`);
}

/**
 * Substitutes {{KEY}} placeholders with `vars[KEY]`. Missing keys → empty string.
 */
export function renderTemplate(source: string, vars: Record<string, string>): string {
  return source.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

export async function loadTemplate(name: string): Promise<string> {
  const dir = await resolveTemplatesDir();
  return fs.readFile(path.join(dir, name), "utf8");
}

export async function tpl(name: string, vars: Record<string, string> = {}): Promise<string> {
  return renderTemplate(await loadTemplate(name), vars);
}
