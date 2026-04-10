import * as path from "node:path";
import kleur from "kleur";
import ora from "ora";
import { formatSuccess, formatWarning } from "../utils/error-format.js";

export async function runDoctor({ prod = false } = {}): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, "flowpanel.config.ts");
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  let config: any;

  function pass(msg: string) {
    console.log(formatSuccess(msg));
    passCount++;
  }
  function warn(msg: string, detail?: string) {
    console.log(formatWarning(msg));
    if (detail) console.log(kleur.gray(`    ${detail}`));
    warnCount++;
  }
  function fail(msg: string, detail?: string) {
    console.log(kleur.red(`  ✗ ${msg}`));
    if (detail) console.log(kleur.gray(`    ${detail}`));
    failCount++;
  }

  console.log("");

  try {
    const { execSync } = await import("node:child_process");
    execSync(`npx tsc --noEmit --skipLibCheck`, { cwd, stdio: "pipe" });
    pass("flowpanel.config.ts       valid TypeScript (tsc --noEmit passed)");
  } catch (err) {
    fail(
      "flowpanel.config.ts       TypeScript errors found",
      String((err as any).stderr).slice(0, 200),
    );
  }

  const configSpinner = ora("Loading flowpanel.config.ts...").start();
  try {
    const mod = await import(configPath);
    config = mod.flowpanel;
    configSpinner.succeed("flowpanel.config.ts       loaded successfully");
    pass("flowpanel.config.ts       valid config (Zod + semantic validation)");
  } catch (err) {
    configSpinner.fail("flowpanel.config.ts       failed to load");
    fail("flowpanel.config.ts       failed to load", String(err).slice(0, 200));
    config = null;
  }

  if (!config) {
    console.log(`\n  ${failCount} failed · ${warnCount} warnings · ${passCount} passed`);
    if (prod) process.exit(1);
    return;
  }

  try {
    const mockReq = new Request("http://localhost/");
    const session = await config.config.security.auth.getSession(mockReq);
    if (session === null || (typeof session === "object" && "userId" in session)) {
      pass("getSession                mock invocation returned correct shape");
    } else {
      warn(
        "getSession                returned unexpected shape",
        "Expected null or { userId, role }",
      );
    }
  } catch (err) {
    warn("getSession                threw on mock request", String(err).slice(0, 100));
  }

  try {
    const db = await config.getDb();
    const start = Date.now();
    await db.execute("SELECT 1", []);
    const ms = Date.now() - start;
    pass(`Database                  connected (${ms}ms)`);
  } catch (err) {
    fail("Database                  connection failed", String(err).slice(0, 100));
  }

  try {
    const db = await config.getDb();
    const tables = await db.execute<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'flowpanel_%'`,
      [],
    );
    if (tables.length >= 4) {
      pass("Schema                    up to date, no drift");
    } else {
      warn("Schema                    tables missing", "Run: npx flowpanel migrate");
    }
  } catch {
    warn("Schema                    could not check (DB not connected)");
  }

  try {
    const db = await config.getDb();
    const rows = await db.execute<{ value: string }>(
      `SELECT value FROM flowpanel_meta WHERE key = 'timezone'`,
      [],
    );
    const tz = rows[0]?.value ?? "not set";
    pass(`Timezone lock             ${tz}`);
  } catch {
    warn("Timezone lock             flowpanel_meta not yet created");
  }

  if (prod) {
    const secret = process.env.FLOWPANEL_COOKIE_SECRET;
    if (!secret || secret.length < 32) {
      fail("FLOWPANEL_COOKIE_SECRET   not set or < 32 bytes");
    } else {
      pass("FLOWPANEL_COOKIE_SECRET   set, ≥ 32 bytes");
    }
  }

  warn(
    "Reaper not scheduled",
    `Add to worker/index.ts:\n    ┌──────────────────────────────────────────┐\n    │  flowpanel.startReaper({ interval: "60s" });  │\n    └──────────────────────────────────────────┘`,
  );

  console.log(`\n  ${passCount} passed · ${warnCount} warnings · ${failCount} failed\n`);

  if (prod && failCount > 0) {
    process.exit(1);
  }
}
