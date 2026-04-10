import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import kleur from "kleur";

const CACHE_DIR = path.join(os.homedir(), ".flowpanel");
const CACHE_FILE = path.join(CACHE_DIR, "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    // Check cache first
    try {
      const cached = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
      if (Date.now() - cached.checkedAt < CHECK_INTERVAL_MS) {
        if (cached.latest && cached.latest !== currentVersion) {
          printUpdateBanner(currentVersion, cached.latest);
        }
        return;
      }
    } catch {}

    // Fetch latest version
    const res = await fetch("https://registry.npmjs.org/@flowpanel/cli/latest");
    if (!res.ok) return;
    const data = (await res.json()) as { version: string };
    const latest = data.version;

    // Cache result
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify({ latest, checkedAt: Date.now() }), "utf8");

    if (latest !== currentVersion) {
      printUpdateBanner(currentVersion, latest);
    }
  } catch {
    // Silent failure — never block CLI on update check
  }
}

function printUpdateBanner(current: string, latest: string): void {
  console.log(kleur.yellow(`\n  Update available: ${current} → ${latest}`));
  console.log(kleur.gray("  Run: pnpm add -g @flowpanel/cli\n"));
}
