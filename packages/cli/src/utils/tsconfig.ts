import path from "node:path";
import { ts } from "ts-morph";

export interface TsconfigCompilerOptions {
  paths?: Record<string, string[]>;
  /** Absolute origin used to resolve paths, including inherited declarations. */
  baseUrl?: string;
}

/** Read JSONC and extends through TypeScript without loading or executing project sources. */
export async function readTsconfigOptions(cwd: string): Promise<TsconfigCompilerOptions | null> {
  const configPath = path.join(cwd, "tsconfig.json");
  const input = ts.readConfigFile(configPath, ts.sys.readFile);
  if (input.error) return null;
  const parsed = ts.parseJsonConfigFileContent(
    input.config,
    { ...ts.sys, readDirectory: () => [] },
    cwd,
    undefined,
    configPath,
  );
  // This scan deliberately does not enumerate input files. Invalid/missing bases,
  // cycles and malformed options must not turn a partial config into a valid alias.
  if (parsed.errors.some(({ code }) => code !== 18002 && code !== 18003)) return null;
  const { baseUrl, paths } = parsed.options;
  // TypeScript records the config that declared paths when no baseUrl is set.
  const pathsOrigin = parsed.options.pathsBasePath;
  return {
    baseUrl: baseUrl ?? (typeof pathsOrigin === "string" ? pathsOrigin : cwd),
    ...(paths ? { paths } : {}),
  };
}
