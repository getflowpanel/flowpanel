import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateLlmsText, LLMS_FILE } from "./docs/generate-llms";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(join(root, LLMS_FILE), generateLlmsText(root));
console.log(`✔ ${LLMS_FILE} regenerated`);
