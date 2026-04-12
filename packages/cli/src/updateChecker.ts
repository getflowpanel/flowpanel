import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import kleur from "kleur";

const CACHE_DIR = path.join(process.env["HOME"] ?? process.env["USERPROFILE"] ?? ".", ".flowpanel");
const CACHE_PATH = path.join(CACHE_DIR, "update-check.json");
const CACHE_TTL = 86_400_000; // 24h

export function checkForUpdates(currentVersion: string): void {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as {
        latest: string;
        checkedAt: number;
      };
      if (Date.now() - cached.checkedAt < CACHE_TTL) {
        if (cached.latest !== currentVersion) printNotice(currentVersion, cached.latest);
        return;
      }
    }
    const latest = execSync("npm view @flowpanel/cli version", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ latest, checkedAt: Date.now() }));
    if (latest !== currentVersion) printNotice(currentVersion, latest);
  } catch {
    // Silent on network failure
  }
}

function printNotice(current: string, latest: string): void {
  console.log(
    `\n  ${kleur.yellow("Update available:")} ${kleur.dim(current)} → ${kleur.green(latest)}` +
      `\n  Run: ${kleur.cyan("npm install @flowpanel/cli@latest")}\n`,
  );
}
