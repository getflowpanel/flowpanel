import * as fs from "node:fs";
import * as path from "node:path";

/** Highest precedence first. Neither loader overwrites, so the first file to set a key wins. */
const ENV_FILES = [".env.local", ".env"];

function parseInto(src: string): void {
  for (const rawLine of src.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice("export ".length).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** Loads `.env.local` then `.env` from `cwd`; a key already set in the environment wins over the file. */
export function loadDotEnv(cwd: string = process.cwd()): void {
  for (const name of ENV_FILES) {
    const file = path.join(cwd, name);
    if (!fs.existsSync(file)) continue;
    if (typeof process.loadEnvFile === "function") process.loadEnvFile(file);
    else parseInto(fs.readFileSync(file, "utf8"));
  }
}
