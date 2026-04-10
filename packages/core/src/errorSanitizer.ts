import * as path from "node:path";

const MAX_FRAMES = 20;

export function sanitizeStack(stack: string, cwd: string): string {
  const lines = stack.split("\n");
  const header = lines[0] ?? "";
  const frameLines = lines.slice(1);

  const filtered = frameLines
    .filter((line) => !line.includes("node:internal/"))
    .map((line) => {
      // Keep @flowpanel frames as-is
      if (line.match(/node_modules[\\/]@flowpanel[\\/]/)) {
        return line;
      }

      // Collapse other node_modules to package name
      const nmMatch = line.match(/\(node_modules[\\/](@[^\\/]+[\\/][^\\/]+|[^\\/]+)[\\/]/);
      if (nmMatch) {
        return line.replace(/\(node_modules[\\/][^)]+\)/, `(${nmMatch[1]})`);
      }

      // Strip absolute cwd prefix from paths
      const cwdWithSep = cwd + path.sep;
      return line.split(cwdWithSep).join("");
    });

  const truncated =
    filtered.length > MAX_FRAMES
      ? [...filtered.slice(0, MAX_FRAMES), `    [${filtered.length - MAX_FRAMES} frames omitted]`]
      : filtered;

  return [header, ...truncated].join("\n");
}

export function sanitizeError(
  error: unknown,
  cwd: string,
  redactStr: (s: string) => string = (s) => s,
): { errorClass: string; errorMessage: string; errorStack: string } {
  if (!(error instanceof Error)) {
    return {
      errorClass: "UnknownError",
      errorMessage: redactStr(String(error)),
      errorStack: "",
    };
  }
  return {
    errorClass: error.constructor.name,
    errorMessage: redactStr(error.message),
    errorStack: sanitizeStack(redactStr(error.stack ?? ""), cwd),
  };
}
