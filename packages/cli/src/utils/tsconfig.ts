import fs from "node:fs/promises";
import path from "node:path";

/** Strip `//` and `/* *​/` comments without touching the same sequences inside strings. */
export function stripJsoncComments(src: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < src.length) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export interface TsconfigCompilerOptions {
  paths?: Record<string, string[]>;
  baseUrl?: string;
}

/** Read `tsconfig.json` as JSONC. Returns `null` when it is missing or unparsable. */
export async function readTsconfigOptions(cwd: string): Promise<TsconfigCompilerOptions | null> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(cwd, "tsconfig.json"), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(stripJsoncComments(raw).replace(/,(\s*[}\]])/g, "$1")) as {
      compilerOptions?: TsconfigCompilerOptions;
    };
    return parsed.compilerOptions ?? {};
  } catch {
    return null;
  }
}
