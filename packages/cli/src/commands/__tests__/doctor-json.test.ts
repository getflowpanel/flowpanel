import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../program";

vi.setConfig({ testTimeout: 30_000 });

const WARNING = "resource users: create is enabled but required column `email` has no field";

let root: string;
let written: string[];

async function runDoctorJson(config: string): Promise<Record<string, unknown>> {
  await fs.writeFile(path.join(root, "flowpanel.config.ts"), config);
  await expect(
    createProgram().parseAsync(["node", "flowpanel", "doctor", "--json"]),
  ).rejects.toThrow(/exit/);
  return JSON.parse(written.join("")) as Record<string, unknown>;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-doctor-json-"));
  written = [];
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ dependencies: { next: "16.3.0", "drizzle-orm": "0.45.2" } }),
  );
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`exit ${code}`);
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

describe("doctor --json", () => {
  it("carries the config's own warnings in the document a CI job reads", async () => {
    const payload = await runDoctorJson(
      `export default { __resolved: true, warnings: ${JSON.stringify([WARNING])} };`,
    );
    expect(payload.configWarnings).toEqual([WARNING]);
    expect(payload.configUnreadable).toBeUndefined();
  });

  it("says in the same document when the config could not be evaluated", async () => {
    const payload = await runDoctorJson('throw new Error("DATABASE_URL is not set");');
    expect(payload.configWarnings).toEqual([]);
    expect(payload.configUnreadable).toContain("DATABASE_URL is not set");
  });
});
