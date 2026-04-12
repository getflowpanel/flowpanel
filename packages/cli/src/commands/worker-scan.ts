import * as fs from "node:fs/promises";
import * as path from "node:path";
import kleur from "kleur";

export async function runWorkerScan(): Promise<void> {
  const cwd = process.cwd();

  // biome-ignore lint/suspicious/noExplicitAny: dynamically loaded config
  let config: any;
  try {
    config = (await import(path.join(cwd, "flowpanel.config.ts"))).flowpanel;
  } catch {
    console.error(kleur.red("Failed to load flowpanel.config.ts"));
    process.exit(1);
  }

  const stages: string[] = config.config.pipeline.stages;
  const patterns = ["worker/processors/**/*.ts", "src/app/api/**/route.ts"];

  const candidates: Array<{
    file: string;
    fn: string;
    stageGuess: string;
    confidence: string;
    wrapped: boolean;
  }> = [];

  for (const pattern of patterns) {
    // Simple glob using recursive readdir
    const files = await findFiles(cwd, pattern);
    for (const file of files) {
      const content = await fs.readFile(path.join(cwd, file), "utf8");
      const alreadyWrapped = content.includes("flowpanel.withRun(") || content.includes("withRun(");

      const fnMatches = content.matchAll(/export async function (\w+)/g);
      for (const match of fnMatches) {
        const fnName = match[1]!;
        const stageGuess = guessStage(file, fnName, stages);
        candidates.push({
          file,
          fn: fnName,
          stageGuess: stageGuess.name,
          confidence: stageGuess.confidence,
          wrapped: alreadyWrapped,
        });
      }
    }
  }

  const unwrapped = candidates.filter((c) => !c.wrapped);
  const wrapped = candidates.filter((c) => c.wrapped);

  console.log(
    `\n  found ${candidates.length} candidates · ${wrapped.length} already wrapped · ${unwrapped.length} suggested\n`,
  );

  for (const c of unwrapped) {
    console.log(kleur.yellow(`  ${c.file}`));
    console.log(`    → export async function ${kleur.bold(c.fn)}`);
    console.log(kleur.gray(`      stage guess: "${c.stageGuess}"   confidence: ${c.confidence}`));
    console.log("");
  }

  if (unwrapped.length > 0) {
    console.log(kleur.gray("  To wrap automatically: npx flowpanel worker:wrap"));
  }
}

async function findFiles(cwd: string, pattern: string): Promise<string[]> {
  // Simple implementation: walk directories matching pattern prefix
  const parts = pattern.split("/");
  const results: string[] = [];

  async function walk(dir: string, remaining: string[]): Promise<void> {
    if (remaining.length === 0) return;
    const segment = remaining[0]!;
    const rest = remaining.slice(1);

    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (segment === "**") {
      // Match all subdirectories recursively
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await walk(path.join(dir, entry.name), remaining); // stay in ** mode
          await walk(path.join(dir, entry.name), rest); // try consuming **
        } else if (rest.length === 1) {
          const lastPattern = rest[0]!;
          if (matchGlob(entry.name, lastPattern)) {
            results.push(path.relative(cwd, path.join(dir, entry.name)));
          }
        }
      }
    } else if (rest.length === 0) {
      // Last segment — match files
      for (const entry of entries) {
        if (!entry.isDirectory() && matchGlob(entry.name, segment)) {
          results.push(path.relative(cwd, path.join(dir, entry.name)));
        }
      }
    } else {
      // Match directories
      for (const entry of entries) {
        if (entry.isDirectory() && matchGlob(entry.name, segment)) {
          await walk(path.join(dir, entry.name), rest);
        }
      }
    }
  }

  await walk(cwd, parts);
  return results;
}

function matchGlob(name: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.startsWith("*.")) {
    return name.endsWith(pattern.slice(1));
  }
  return name === pattern;
}

function guessStage(
  file: string,
  fnName: string,
  stages: string[],
): { name: string; confidence: string } {
  const lowerFile = file.toLowerCase();
  const lowerFn = fnName.toLowerCase();

  for (const stage of stages) {
    if (lowerFile.includes(stage) || lowerFn.includes(stage)) {
      return { name: stage, confidence: "high" };
    }
  }

  const heuristics: Record<string, string> = {
    poll: "parse",
    scrape: "parse",
    fetch: "parse",
    score: "score",
    rank: "score",
    classify: "score",
    draft: "draft",
    generate: "draft",
    compose: "draft",
    notify: "notify",
    send: "notify",
    dispatch: "notify",
  };

  for (const [keyword, stage] of Object.entries(heuristics)) {
    if (lowerFile.includes(keyword) || lowerFn.includes(keyword)) {
      return { name: stage, confidence: "medium" };
    }
  }

  return { name: stages[0] ?? "parse", confidence: "low" };
}
