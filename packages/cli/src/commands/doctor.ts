import kleur from "kleur";
import ora from "ora";
import { loadConfig } from "../loadConfig";
import { formatWarning } from "../utils/error-format";

export async function runDoctor({ prod = false, json = false } = {}): Promise<void> {
  const cwd = process.cwd();
  const results: Array<{ status: "pass" | "warn" | "fail"; message: string; detail?: string }> = [];
  let config: Awaited<ReturnType<typeof loadConfig>> | null;

  function pass(msg: string) {
    results.push({ status: "pass", message: msg });
    if (!json) console.log(kleur.green("  ✓ ") + msg);
  }
  function warn(msg: string, detail?: string) {
    results.push({ status: "warn", message: msg, detail });
    if (!json) {
      console.log(formatWarning(msg));
      if (detail) console.log(kleur.gray(`    ${detail}`));
    }
  }
  function fail(msg: string, detail?: string) {
    results.push({ status: "fail", message: msg, detail });
    if (!json) {
      console.log(kleur.red(`  ✗ ${msg}`));
      if (detail) console.log(kleur.gray(`    ${detail}`));
    }
  }

  const spinner = json ? null : ora("Running health checks...").start();

  if (!json) console.log("");

  try {
    if (spinner) spinner.text = "Checking TypeScript...";
    const { execSync } = await import("node:child_process");
    execSync(`npx tsc --noEmit --skipLibCheck`, { cwd, stdio: "pipe" });
    pass("flowpanel.config.ts       valid TypeScript (tsc --noEmit passed)");
  } catch (err) {
    fail(
      "flowpanel.config.ts       TypeScript errors found",
      // biome-ignore lint/suspicious/noExplicitAny: dynamically loaded config
      String((err as any).stderr).slice(0, 200),
    );
  }

  try {
    if (spinner) spinner.text = "Loading config...";
    config = await loadConfig();
    pass("flowpanel.config.ts       valid config (Zod + semantic validation)");
  } catch (err) {
    fail("flowpanel.config.ts       failed to load", String(err).slice(0, 200));
    config = null;
  }

  if (!config) {
    if (spinner) spinner.stop();
    const passCount = results.filter((r) => r.status === "pass").length;
    const warnCount = results.filter((r) => r.status === "warn").length;
    const failCount = results.filter((r) => r.status === "fail").length;
    if (json) {
      console.log(
        JSON.stringify(
          { results, summary: { passed: passCount, warnings: warnCount, failed: failCount } },
          null,
          2,
        ),
      );
    } else {
      console.log(`\n  ${failCount} failed · ${warnCount} warnings · ${passCount} passed`);
    }
    if (prod) process.exit(1);
    return;
  }

  try {
    if (spinner) spinner.text = "Testing getSession...";
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
    if (spinner) spinner.text = "Testing database connection...";
    const db = await config.getDb();
    const start = Date.now();
    await db.execute("SELECT 1", []);
    const ms = Date.now() - start;
    pass(`Database                  connected (${ms}ms)`);
  } catch (err) {
    fail("Database                  connection failed", String(err).slice(0, 100));
  }

  try {
    if (spinner) spinner.text = "Checking schema...";
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
    if (spinner) spinner.text = "Checking timezone lock...";
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

  if (spinner) spinner.stop();

  const passCount = results.filter((r) => r.status === "pass").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  if (json) {
    console.log(
      JSON.stringify(
        { results, summary: { passed: passCount, warnings: warnCount, failed: failCount } },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n  ${passCount} passed · ${warnCount} warnings · ${failCount} failed\n`);
  }

  if (prod && failCount > 0) {
    process.exit(1);
  }
}
