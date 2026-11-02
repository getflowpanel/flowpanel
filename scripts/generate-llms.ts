import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expansionContext, generateLlmsText, LLMS_FILE } from "./docs/generate-llms";
import {
  generateLlmsTopics,
  LLMS_TOPIC_MAX_LINES,
  LLMS_TOPICS_DIR,
} from "./docs/generate-llms-topics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const context = expansionContext(root);
writeFileSync(join(root, LLMS_FILE), generateLlmsText(root, context));
console.log(`✔ ${LLMS_FILE} regenerated`);

const topics = join(root, LLMS_TOPICS_DIR);
rmSync(topics, { recursive: true, force: true });
mkdirSync(topics, { recursive: true });
for (const [file, text] of generateLlmsTopics(root, LLMS_TOPIC_MAX_LINES, context)) {
  writeFileSync(join(topics, file), text);
}
console.log(`✔ ${LLMS_TOPICS_DIR}/ regenerated`);
