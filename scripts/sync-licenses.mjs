import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const rootLicense = readFileSync(join(root, "LICENSE"), "utf8");

export function publishablePackages() {
  return readdirSync(join(root, "packages"))
    .filter((name) => existsSync(join(root, "packages", name, "package.json")))
    .filter((name) => {
      const manifest = JSON.parse(
        readFileSync(join(root, "packages", name, "package.json"), "utf8"),
      );
      return manifest.private !== true;
    })
    .sort();
}

export function licenseProblems() {
  const problems = [];
  for (const name of publishablePackages()) {
    const path = join("packages", name, "LICENSE");
    if (!existsSync(join(root, path))) {
      problems.push(`${path}: missing; run \`pnpm sync:licenses\``);
    } else if (readFileSync(join(root, path), "utf8") !== rootLicense) {
      problems.push(`${path}: drifted from the root LICENSE; run \`pnpm sync:licenses\``);
    }
  }
  return problems;
}

export function syncLicenses() {
  const published = new Set(publishablePackages());
  const written = [];
  for (const name of readdirSync(join(root, "packages"))) {
    const path = join(root, "packages", name, "LICENSE");
    if (published.has(name)) {
      if (!existsSync(path) || readFileSync(path, "utf8") !== rootLicense) {
        writeFileSync(path, rootLicense);
      }
      written.push(name);
    } else if (existsSync(path)) {
      rmSync(path);
    }
  }
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const written = syncLicenses();
  console.log(`✔ LICENSE synced into ${written.length} publishable package(s)`);
}
